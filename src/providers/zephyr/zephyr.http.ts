// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderStep, ProviderTestRef, SearchOptions } from '../types'
import { normalizeSearchPage } from './zephyrSearchParsing'
import { buildUpsertBodies, shouldRetryVariablePayload } from './zephyrUpsertPayload'
import { normalizeRemoteAttachments, safeStr } from './zephyrValueMapping'

export interface ZephyrApiClient {
    zephyrGetTestCase<T = unknown>(ref: string, by: 'id' | 'key'): Promise<T>
    zephyrSearchTestCases<T = unknown>(query: string, startAt?: number, maxResults?: number): Promise<T>
    zephyrUpsertTestCase<T = unknown>(body: unknown, ref?: string): Promise<T>
    zephyrUploadAttachment(testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }): Promise<void>
    zephyrDeleteAttachment(attachmentId: string): Promise<void>
}

type ZephyrAttachmentResponse = Record<string, unknown>

type ZephyrTestCaseResponse = {
    key?: string
    name?: string
    description?: string | null
    labels?: string[]
    updatedOn?: string
    owner?: string
    updatedBy?: string
    createdBy?: string
    createdOn?: string
    keyNumber?: number
    priority?: string
    component?: string
    projectKey?: string
    objective?: string | null
    precondition?: string | null
    folder?: string
    latestVersion?: boolean
    lastTestResultStatus?: string
    status?: string
    issueLinks?: string[]
    customFields?: Record<string, unknown>
    parameters?: { variables?: unknown[]; entries?: unknown[] }
    testScript?: {
        type?: string
        steps?: Array<{
            id?: number | string
            index?: number
            description?: string | null
            testData?: string | null
            expectedResult?: string | null
            testCaseKey?: string | null
            attachments?: ZephyrAttachmentResponse[]
        }>
    }
    attachments?: ZephyrAttachmentResponse[]
}

function parseRef(raw: string): { by: 'id' | 'key'; ref: string } {
    const value = String(raw ?? '').trim()
    if (/^\d+$/.test(value)) return { by: 'id', ref: value }
    if (/-/.test(value)) return { by: 'key', ref: value }
    return { by: 'key', ref: value }
}

// Provider facade
export class ZephyrHttpProvider implements ITestProvider {
    constructor(private client: ZephyrApiClient) {}

    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const { by, ref } = parseRef(externalId)
        const json = (await this.client.zephyrGetTestCase(ref, by)) as ZephyrTestCaseResponse

        const steps: ProviderStep[] = (json.testScript?.steps ?? [])
            .filter((step) => step && (step.description || step.testData || step.expectedResult))
            .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
            .map((step, index) => ({
                action: String(step.description ?? ''),
                data: String(step.testData ?? ''),
                expected: String(step.expectedResult ?? ''),
                text: String(step.description ?? ''),
                providerStepId: String(step.id ?? `index:${step.index ?? index + 1}`),
                attachments: normalizeRemoteAttachments(step.attachments, `step:${step.id ?? index + 1}`),
            }))

        const extras: Record<string, unknown> = {
            key: json.key,
            keyNumber: json.keyNumber,
            status: json.status,
            priority: json.priority,
            component: json.component,
            projectKey: json.projectKey,
            folder: json.folder,
            latestVersion: json.latestVersion,
            lastTestResultStatus: json.lastTestResultStatus,
            owner: json.owner,
            updatedBy: json.updatedBy,
            createdBy: json.createdBy,
            createdOn: json.createdOn,
            updatedOn: json.updatedOn,
            issueLinks: json.issueLinks ?? [],
            customFields: json.customFields ?? {},
            parameters: json.parameters ?? { variables: [], entries: [] },
            objective: json.objective ?? null,
            preconditions: json.precondition ?? null,
            labels: json.labels ?? [],
        }

        return {
            id: json.key || ref,
            name: String(json.name ?? (json.key || ref)),
            description: json.description ?? undefined,
            steps,
            attachments: normalizeRemoteAttachments(json.attachments, json.key || ref),
            updatedAt: json.updatedOn ?? new Date().toISOString(),
            extras,
        }
    }

    async searchTestsByQuery(query: string, opts: SearchOptions = {}): Promise<ProviderTestRef[]> {
        const limit = Math.max(1, Math.min(Number(opts.maxResults ?? 100) || 100, 500))
        const startAt = Math.max(0, Number(opts.startAt ?? 0) || 0)
        const pageSize = Math.min(limit, 100)
        const out: ProviderTestRef[] = []
        const seen = new Set<string>()
        let cursor = startAt

        while (out.length < limit) {
            const raw = await this.client.zephyrSearchTestCases(query, cursor, Math.min(pageSize, limit - out.length))
            const page = normalizeSearchPage(raw)
            if (!page.items.length) break

            for (const item of page.items) {
                if (seen.has(item.ref)) continue
                seen.add(item.ref)
                out.push(item)
                if (out.length >= limit) break
            }

            if (!page.hasMore) break
            cursor = page.nextStartAt
        }

        return out
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        const parsed = parseRef(payload.id)
        const ref = parsed.by === 'key' ? parsed.ref : ''
        const bodies = buildUpsertBodies(payload, Boolean(parsed.ref))
        let lastError: unknown = null

        for (let index = 0; index < bodies.length; index += 1) {
            const body = bodies[index]
            try {
                const json = await this.client.zephyrUpsertTestCase<Record<string, unknown>>(body, ref || undefined)
                return { externalId: safeStr(json?.key).trim() || ref || payload.id || '' }
            } catch (error) {
                lastError = error
                if (!shouldRetryVariablePayload(error) || index === bodies.length - 1) break
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Zephyr upsert failed'))
    }

    async attach(externalId: string, attachment: { name: string; pathOrDataUrl: string }) {
        return this.client.zephyrUploadAttachment(externalId, attachment)
    }

    async deleteAttachment(_externalId: string, attachmentId: string) {
        return this.client.zephyrDeleteAttachment(attachmentId)
    }
}
