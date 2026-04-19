import type { ProviderTest, ITestProvider, PushOptions } from '@providers/types'
import { fromProviderPayload, toProviderPayload } from '@providers/mappers'
import { normalizeTestCase, type ProviderKind, type RootState, type TestCase, type TestCaseLink } from '@core/domain'
import { buildExport } from '@core/export'
import { isZephyrHtmlPartsEnabled, preserveZephyrHtmlPartsFlag } from '@core/zephyrHtmlParts'
import { getStoredJsonBeautifyTolerant } from '@shared/uiPreferences'
import type { SyncText } from './text'
import { resolvePullLink, type SyncService } from './service'
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
    resolveZephyrExternalId,
    type ZephyrPublishPreview,
    type ZephyrPublishPreviewItem,
    type ZephyrPublishLogItem,
    type ZephyrPublishResult,
} from './zephyrPublish'
import { extractPublishDebug } from './publishDebug'
import { mapTests, findNode, isFolder } from '@core/tree'

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
        return resolvePullLink(test, (link) => this.pullByLink(link))
    }

    async previewZephyrImport(state: RootState, request: ZephyrImportRequest): Promise<ZephyrImportPreview> {
        const zephyr = this.providerBy('zephyr')
        const query = buildZephyrImportQuery(request)
        const refs = await this.resolveImportRefs(zephyr, query, request)
        const remotes = await Promise.all(refs.map((ref) => zephyr.getTestDetails(ref, { includeAttachments: true })))
        return buildZephyrImportPreview(state, request, remotes, this.text, query)
    }

    private async resolveImportRefs(provider: ITestProvider, query: string, request: ZephyrImportRequest): Promise<string[]> {
        if (request.mode === 'keys') {
            return [...new Set((request.refs ?? []).map((ref) => String(ref).trim()).filter(Boolean))]
        }
        return this.collectZephyrRefs(provider, query, request.maxResults ?? 100)
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
                .map((test) => resolveZephyrExternalId(test) ?? '')
                .map((item) => String(item).trim())
                .filter(Boolean)
        )]

        const settled = await Promise.allSettled(
            remoteIds.map((id) => zephyr.getTestDetails(id, { includeAttachments: true }))
        )
        const remoteMap = new Map<string, ProviderTest | Error>(
            remoteIds.map((id, i) => {
                const r = settled[i]
                return [id, r.status === 'fulfilled' ? r.value : toError(r.reason)]
            })
        )

        return buildZephyrPublishPreview(state, tests, remoteMap, selectionLabel, this.text)
    }

    async publishZephyrPreview(state: RootState, preview: ZephyrPublishPreview): Promise<ZephyrPublishResult> {
        const provider = this.providerBy('zephyr')
        const result: ZephyrPublishResult = { created: 0, updated: 0, skipped: 0, failed: 0, blocked: 0, logItems: [] }

        for (const item of preview.items) {
            const logItem = await this.processPublishItem(provider, state, item)
            result.logItems.push(logItem)
            if (logItem.status === 'created') result.created += 1
            else if (logItem.status === 'updated') result.updated += 1
            else if (logItem.status === 'blocked') result.blocked += 1
            else if (logItem.status === 'failed') result.failed += 1
            else result.skipped += 1
        }

        return result
    }

    private async processPublishItem(
        provider: ITestProvider,
        state: RootState,
        item: ZephyrPublishPreviewItem
    ): Promise<ZephyrPublishLogItem> {
        const base = {
            testId: item.testId,
            testName: item.testName,
            externalId: item.externalId,
            reason: item.reason,
            attachmentWarnings: item.attachmentWarnings,
        }

        if (item.status === 'blocked') return { ...base, status: 'blocked' }
        if (!item.publish || item.status === 'skip') return { ...base, status: 'skipped' }

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
            return { ...base, externalId, status: item.status === 'create' ? 'created' : 'updated' }
        } catch (error) {
            return {
                ...base,
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
                debug: extractPublishDebug(error),
            }
        }
    }

    async twoWaySync(state: RootState): Promise<void> {
        const tests = state.root ? mapTests(state.root) : []
        for (const test of tests) {
            for (const link of test.links) {
                const provider = this.providers[link.provider]
                const remote = await provider.getTestDetails(link.externalId, {})
                if (!remote.updatedAt || test.updatedAt > remote.updatedAt) {
                    const exported = buildExport(test, state)
                    await provider.upsertTest(toProviderPayload(exported), { pushAttachments: true } as PushOptions)
                    continue
                }

                Object.assign(test, this.mergeRemote(test, remote))
            }
        }
    }

    private mergeRemote(test: TestCase, remote: ProviderTest): TestCase {
        const patch = fromProviderPayload(remote, test.steps, {
            parseHtmlParts: isZephyrHtmlPartsEnabled(test),
            tolerantJsonBeautify: getStoredJsonBeautifyTolerant(),
        })
        return preserveZephyrHtmlPartsFlag(
            test,
            normalizeTestCase({
                ...test,
                name: patch.name,
                description: patch.description,
                steps: patch.steps,
                attachments: patch.attachments,
                details: patch.details,
                integration: patch.integration,
                updatedAt: patch.updatedAt ?? new Date().toISOString(),
            })
        )
    }

    private async collectZephyrRefs(provider: ITestProvider, query: string, maxResults: number): Promise<string[]> {
        if (!provider.searchTestsByQuery) throw new Error('Current Zephyr provider does not support search import')
        const refs = await provider.searchTestsByQuery(query, { maxResults })
        return [...new Set(refs.map((item) => item.ref).filter(Boolean))]
    }

}

function toError(reason: unknown): Error {
    return reason instanceof Error ? reason : new Error(String(reason))
}
