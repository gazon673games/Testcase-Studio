// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderStep, ProviderTestRef, SearchOptions } from './types'
import { apiClient } from '@ipc/client'

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
        }>
    }
    attachments?: any[]
}

// разбор ссылки пользователя: ID vs KEY
function parseRef(raw: string): { by: 'id' | 'key'; ref: string } {
    const t = String(raw ?? '').trim()
    if (/^\d+$/.test(t)) return { by: 'id', ref: t }  // только цифры → ID
    if (/-/.test(t))   return { by: 'key', ref: t }   // есть дефис → KEY
    return { by: 'key', ref: t }
}

export class ZephyrHttpProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const { by, ref } = parseRef(externalId)
        // ⚠️ CORS обходим через IPC в main
        const json = (await apiClient.zephyrGetTestCase(ref, by)) as ZephyrTestCaseResponse

        const steps: ProviderStep[] = (json.testScript?.steps ?? [])
            .filter((s) => s && (s.description || s.testData || s.expectedResult))
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((s, index) => ({
                action:   String(s.description ?? ''),
                data:     String(s.testData ?? ''),
                expected: String(s.expectedResult ?? ''),
                text:     String(s.description ?? ''),
                providerStepId: String(s.id ?? `index:${s.index ?? index + 1}`),
            }))

        // ✨ Собираем extras — всё, что нужно разложить в meta.params
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
            attachments: [],
            updatedAt: json.updatedOn ?? new Date().toISOString(),
            extras, // ← NEW
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
            const raw = await apiClient.zephyrSearchTestCases(query, cursor, Math.min(pageSize, limit - out.length))
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
        const ref = parseRef(payload.id).by === 'key' ? parseRef(payload.id).ref : ''
        const body = buildUpsertBody(payload)
        const json = await apiClient.zephyrUpsertTestCase(body, ref || undefined)
        return { externalId: safeStr(json?.key).trim() || ref || payload.id || '' }
    }
    async attach() {}
    async deleteAttachment() {}
}

function normalizeSearchPage(raw: any): { items: ProviderTestRef[]; hasMore: boolean; nextStartAt: number } {
    const rawItems = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.values)
                ? raw.values
                : Array.isArray(raw?.results)
                    ? raw.results
                    : []

    const items = rawItems
        .map(normalizeSearchItem)
        .filter((item): item is ProviderTestRef => Boolean(item))

    const currentStartAt = toNumber(raw?.startAt ?? raw?.offset) ?? 0
    const nextStartAt = currentStartAt + rawItems.length
    const total = toNumber(raw?.total ?? raw?.totalCount ?? raw?.size)
    const configuredPageSize = toNumber(raw?.maxResults ?? raw?.pageSize ?? raw?.limit)
    const hasMore = total != null
        ? nextStartAt < total
        : configuredPageSize != null
            ? rawItems.length >= configuredPageSize && rawItems.length > 0
            : false

    return { items, hasMore, nextStartAt }
}

function normalizeSearchItem(raw: any): ProviderTestRef | null {
    const key = safeStr(raw?.key ?? raw?.testCaseKey ?? raw?.testCase?.key).trim()
    const id = safeStr(raw?.id ?? raw?.testCase?.id).trim()
    const ref = key || id
    if (!ref) return null

    return {
        ref,
        key: key || undefined,
        name: safeStr(raw?.name ?? raw?.testCase?.name).trim() || undefined,
        folder: safeStr(raw?.folder ?? raw?.testCase?.folder).trim() || undefined,
        projectKey: safeStr(raw?.projectKey ?? raw?.project?.key ?? raw?.testCase?.projectKey).trim() || undefined,
        updatedAt: safeStr(raw?.updatedOn ?? raw?.updatedAt ?? raw?.testCase?.updatedOn).trim() || undefined,
    }
}

function toNumber(value: unknown): number | undefined {
    const next = Number(value)
    return Number.isFinite(next) ? next : undefined
}

function buildUpsertBody(payload: ProviderTest) {
    const extras = payload.extras ?? {}
    const body: Record<string, unknown> = {
        name: safeStr(payload.name),
    }

    const projectKey = safeStr(extras.projectKey).trim()
    if (projectKey) body.projectKey = projectKey

    const description = safeStr(payload.description).trim()
    if (description) body.description = description

    const folder = safeStr(extras.folder).trim()
    if (folder) body.folder = folder

    const objective = safeStr(extras.objective).trim()
    if (objective) body.objective = objective

    const preconditions = safeStr(extras.preconditions).trim()
    if (preconditions) body.precondition = preconditions

    const labels = Array.isArray(extras.labels)
        ? extras.labels.map((item) => safeStr(item).trim()).filter(Boolean)
        : []
    if (labels.length) body.labels = labels

    body.testScript = {
        type: 'STEP_BY_STEP',
        steps: (payload.steps ?? []).map((step) => ({
            description: safeStr(step.action || step.text).trim(),
            testData: safeStr(step.data).trim(),
            expectedResult: safeStr(step.expected).trim(),
        })),
    }

    return body
}
