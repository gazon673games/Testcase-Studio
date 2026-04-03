import type { ProviderTest, ITestProvider, PushOptions } from '@providers/types'
import { fromProviderPayload, toProviderPayload } from '@providers/mappers'
import type { ProviderKind, RootState, TestCase, TestCaseLink } from '@core/domain'
import { buildExport } from '@core/export'
import { isZephyrHtmlPartsEnabled, preserveZephyrHtmlPartsFlag } from '@core/zephyrHtmlParts'
import type { SyncText } from './text'
import type { SyncService } from './service'
import {
    applyZephyrImportPreview,
    buildZephyrImportPreview,
    buildZephyrImportQuery,
    type ZephyrImportApplyResult,
    type ZephyrImportPreview,
    type ZephyrImportRequest,
} from './zephyrImport'
import {
    applyPublishSuccess,
    buildZephyrPublishPreview,
    type ZephyrPublishPreview,
    type ZephyrPublishResult,
} from './zephyrPublish'
import { findNode, isFolder } from '@core/tree'

export class SyncEngine implements SyncService {
    constructor(
        private providers: Record<ProviderKind, ITestProvider>,
        private text: SyncText
    ) {}

    private providerBy(kind: ProviderKind) {
        return this.providers[kind]
    }

    async pullByLink(link: TestCaseLink): Promise<ProviderTest> {
        const provider = this.providerBy(link.provider)
        return provider.getTestDetails(link.externalId, { includeAttachments: true })
    }

    async pushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }> {
        const provider = this.providerBy(link.provider)
        const exported = buildExport(test, state)
        return provider.upsertTest(toProviderPayload(exported), { pushAttachments: true })
    }

    async pullPreferZephyr(test: TestCase): Promise<ProviderTest | null> {
        const zephyr = test.links.find((link) => link.provider === 'zephyr')
        if (zephyr) return this.pullByLink(zephyr)

        const allure = test.links.find((link) => link.provider === 'allure')
        if (allure) return this.pullByLink(allure)

        return null
    }

    async previewZephyrImport(state: RootState, request: ZephyrImportRequest): Promise<ZephyrImportPreview> {
        const zephyr = this.providerBy('zephyr')
        const query = buildZephyrImportQuery(request)
        const refs =
            request.mode === 'keys'
                ? [...new Set((request.refs ?? []).map((ref) => String(ref).trim()).filter(Boolean))]
                : await this.collectZephyrRefs(zephyr, query, request.maxResults ?? 100)

        const remotes = await Promise.all(
            refs.map((ref) => zephyr.getTestDetails(ref, { includeAttachments: true }))
        )

        return buildZephyrImportPreview(state, request, remotes, this.text, query)
    }

    applyZephyrImport(state: RootState, preview: ZephyrImportPreview): ZephyrImportApplyResult {
        return applyZephyrImportPreview(state, preview, this.text)
    }

    async previewZephyrPublish(
        state: RootState,
        tests: TestCase[],
        selectionLabel: string
    ): Promise<ZephyrPublishPreview> {
        const zephyr = this.providerBy('zephyr')
        const remoteIds = [...new Set(
            tests
                .map((test) => test.links.find((link) => link.provider === 'zephyr')?.externalId ?? test.meta?.params?.key ?? '')
                .map((item) => String(item).trim())
                .filter(Boolean)
        )]

        const remoteMap = new Map<string, ProviderTest | Error>()
        await Promise.all(
            remoteIds.map(async (externalId) => {
                try {
                    remoteMap.set(externalId, await zephyr.getTestDetails(externalId, { includeAttachments: true }))
                } catch (error) {
                    remoteMap.set(externalId, error instanceof Error ? error : new Error(String(error)))
                }
            })
        )

        return buildZephyrPublishPreview(state, tests, remoteMap, selectionLabel, this.text)
    }

    async publishZephyrPreview(state: RootState, preview: ZephyrPublishPreview): Promise<ZephyrPublishResult> {
        const provider = this.providerBy('zephyr')
        const result: ZephyrPublishResult = { created: 0, updated: 0, skipped: 0, failed: 0, blocked: 0, logItems: [] }

        for (const item of preview.items) {
            if (item.status === 'blocked') {
                result.blocked += 1
                result.logItems.push({
                    testId: item.testId,
                    testName: item.testName,
                    status: 'blocked',
                    externalId: item.externalId,
                    reason: item.reason,
                    attachmentWarnings: item.attachmentWarnings,
                })
                continue
            }

            if (!item.publish || item.status === 'skip') {
                result.skipped += 1
                result.logItems.push({
                    testId: item.testId,
                    testName: item.testName,
                    status: 'skipped',
                    externalId: item.externalId,
                    reason: item.reason,
                    attachmentWarnings: item.attachmentWarnings,
                })
                continue
            }

            try {
                const response = await provider.upsertTest(item.payload, { pushAttachments: false })
                const externalId = response.externalId || item.externalId || item.payload.id || ''
                for (const attachmentId of item.attachmentIdsToDelete) {
                    await provider.deleteAttachment(externalId, attachmentId)
                }
                for (const attachment of item.attachmentsToUpload) {
                    await provider.attach(externalId, attachment)
                }
                const node = findNode(state.root, item.testId)
                if (node && !isFolder(node)) applyPublishSuccess(node, externalId, item.payload)

                if (item.status === 'create') result.created += 1
                else result.updated += 1

                result.logItems.push({
                    testId: item.testId,
                    testName: item.testName,
                    status: item.status === 'create' ? 'created' : 'updated',
                    externalId,
                    reason: item.reason,
                    attachmentWarnings: item.attachmentWarnings,
                })
            } catch (error) {
                result.failed += 1
                result.logItems.push({
                    testId: item.testId,
                    testName: item.testName,
                    status: 'failed',
                    externalId: item.externalId,
                    error: error instanceof Error ? error.message : String(error),
                    attachmentWarnings: item.attachmentWarnings,
                    debug: extractPublishDebug(error),
                })
            }
        }

        return result
    }

    async twoWaySync(state: RootState): Promise<void> {
        const tests = state.root ? this.collectTests(state) : []
        for (const test of tests) {
            for (const link of test.links) {
                const provider = this.providers[link.provider]
                const remote = await provider.getTestDetails(link.externalId, {})
                if (!remote.updatedAt || test.updatedAt > remote.updatedAt) {
                    const exported = buildExport(test, state)
                    await provider.upsertTest(toProviderPayload(exported), { pushAttachments: true } as PushOptions)
                    continue
                }

                const patch = fromProviderPayload(remote, test.steps, {
                    parseHtmlParts: isZephyrHtmlPartsEnabled(test.meta),
                })
                test.name = patch.name
                test.description = patch.description
                test.steps = patch.steps
                test.attachments = patch.attachments
                test.meta = preserveZephyrHtmlPartsFlag(test.meta, patch.meta)
                test.updatedAt = patch.updatedAt ?? new Date().toISOString()
            }
        }
    }

    private async collectZephyrRefs(provider: ITestProvider, query: string, maxResults: number): Promise<string[]> {
        if (!provider.searchTestsByQuery) throw new Error('Current Zephyr provider does not support search import')
        const refs = await provider.searchTestsByQuery(query, { maxResults })
        return [...new Set(refs.map((item) => item.ref).filter(Boolean))]
    }

    private collectTests(state: RootState): TestCase[] {
        const acc: TestCase[] = []
        const walk = (node: any) => {
            if (!node) return
            if (Array.isArray(node.children)) {
                node.children.forEach(walk)
                return
            }
            if (node.steps && node.attachments) acc.push(node)
        }
        walk(state.root)
        return acc
    }
}

function extractPublishDebug(
    error: unknown
): {
    upsertAttempts?: Array<{
        requestBody: unknown
        request?: { method: string; url: string; body?: unknown }
        response?: { status?: number; statusText?: string; body?: string }
        error: string
    }>
} | undefined {
    if (!error || typeof error !== 'object') return undefined

    const attempts = (error as { attempts?: unknown }).attempts
    if (!Array.isArray(attempts) || attempts.length === 0) return undefined

    type PublishDebugAttempt = {
        requestBody: unknown
        request?: { method?: unknown; url?: unknown; body?: unknown }
        response?: { status?: unknown; statusText?: unknown; body?: unknown }
        error: string
    }

    return {
        upsertAttempts: attempts
            .filter((attempt): attempt is PublishDebugAttempt => {
                return Boolean(
                    attempt &&
                    typeof attempt === 'object' &&
                    'error' in attempt
                )
            })
            .map((attempt) => ({
                requestBody: attempt.requestBody,
                request:
                    attempt.request &&
                    typeof attempt.request === 'object' &&
                    typeof attempt.request.method === 'string' &&
                    typeof attempt.request.url === 'string'
                        ? {
                            method: attempt.request.method,
                            url: attempt.request.url,
                            body: attempt.request.body,
                        }
                        : undefined,
                response:
                    attempt.response &&
                    typeof attempt.response === 'object'
                        ? {
                            status: typeof attempt.response.status === 'number' ? attempt.response.status : undefined,
                            statusText: typeof attempt.response.statusText === 'string' ? attempt.response.statusText : undefined,
                            body: typeof attempt.response.body === 'string' ? attempt.response.body : undefined,
                        }
                        : undefined,
                error: String(attempt.error ?? ''),
            })),
    }
}
