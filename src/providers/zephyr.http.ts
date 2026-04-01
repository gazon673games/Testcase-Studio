// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderStep, ProviderTestRef, SearchOptions } from './types'
import { apiClient } from '@ipc/client'

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
                attachments: normalizeRemoteAttachments(s.attachments, `step:${s.id ?? index + 1}`),
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
            attachments: normalizeRemoteAttachments(json.attachments, json.key || ref),
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
        const bodies = buildUpsertBodies(payload)
        let lastError: unknown = null

        for (let index = 0; index < bodies.length; index += 1) {
            const body = bodies[index]
            try {
                const json = await apiClient.zephyrUpsertTestCase(body, ref || undefined)
                return { externalId: safeStr(json?.key).trim() || ref || payload.id || '' }
            } catch (error) {
                lastError = error
                if (!shouldRetryVariablePayload(error) || index === bodies.length - 1) break
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Zephyr upsert failed'))
    }
    async attach(externalId: string, attachment: { name: string; pathOrDataUrl: string }) {
        return apiClient.zephyrUploadAttachment(externalId, attachment)
    }
    async deleteAttachment(_externalId: string, attachmentId: string) {
        return apiClient.zephyrDeleteAttachment(attachmentId)
    }
}

function normalizeSearchPage(raw: unknown): { items: ProviderTestRef[]; hasMore: boolean; nextStartAt: number } {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const rawItems: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray(source.items)
            ? source.items
            : Array.isArray(source.values)
                ? source.values
                : Array.isArray(source.results)
                    ? source.results
                    : []

    const items = rawItems
        .map((item): ProviderTestRef | null => normalizeSearchItem(item))
        .filter((item): item is ProviderTestRef => item !== null)

    const currentStartAt = toNumber(source.startAt ?? source.offset) ?? 0
    const nextStartAt = currentStartAt + rawItems.length
    const total = toNumber(source.total ?? source.totalCount ?? source.size)
    const configuredPageSize = toNumber(source.maxResults ?? source.pageSize ?? source.limit)
    const hasMore = total != null
        ? nextStartAt < total
        : configuredPageSize != null
            ? rawItems.length >= configuredPageSize && rawItems.length > 0
            : false

    return { items, hasMore, nextStartAt }
}

function normalizeSearchItem(raw: unknown): ProviderTestRef | null {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const sourceTestCase = source.testCase && typeof source.testCase === 'object'
        ? source.testCase as Record<string, unknown>
        : undefined
    const sourceProject = source.project && typeof source.project === 'object'
        ? source.project as Record<string, unknown>
        : undefined
    const key = safeStr(source.key ?? source.testCaseKey ?? sourceTestCase?.key).trim()
    const id = safeStr(source.id ?? sourceTestCase?.id).trim()
    const ref = key || id
    if (!ref) return null

    return {
        ref,
        key: key || undefined,
        name: safeStr(source.name ?? sourceTestCase?.name).trim() || undefined,
        folder: safeStr(source.folder ?? sourceTestCase?.folder).trim() || undefined,
        projectKey:
            safeStr(
                source.projectKey ??
                sourceProject?.key ??
                sourceTestCase?.projectKey
            ).trim() || undefined,
        updatedAt:
            safeStr(source.updatedOn ?? source.updatedAt ?? sourceTestCase?.updatedOn).trim() || undefined,
    }
}

function toNumber(value: unknown): number | undefined {
    const next = Number(value)
    return Number.isFinite(next) ? next : undefined
}

function buildUpsertBodies(payload: ProviderTest) {
    const isUpdate = Boolean(parseRef(payload.id).ref)
    const primary = buildUpsertBody(payload, 'structured', isUpdate)
    const fallback = buildUpsertBody(payload, 'name-list', isUpdate)
    const seen = new Set<string>()
    return [primary, fallback].filter((body) => {
        const signature = JSON.stringify(body)
        if (seen.has(signature)) return false
        seen.add(signature)
        return true
    })
}

function buildUpsertBody(
    payload: ProviderTest,
    parameterMode: 'structured' | 'name-list' = 'structured',
    isUpdate = false
) {
    const extras = payload.extras ?? {}
    const changedFields = normalizeChangedFields(extras.__changedFields)
    const body: Record<string, unknown> = {
        name: safeStr(payload.name),
    }

    const projectKey = safeStr(extras.projectKey).trim()
    if (projectKey) body.projectKey = projectKey

    const description = safeStr(payload.description).trim()
    if (!isUpdate || !changedFields || changedFields.has('description')) {
        if (description) body.description = description
    }

    const folder = safeStr(extras.folder).trim()
    if ((!isUpdate || !changedFields || changedFields.has('folder')) && folder) body.folder = folder

    const objective = safeStr(extras.objective).trim()
    if ((!isUpdate || !changedFields || changedFields.has('objective')) && objective) body.objective = objective

    const preconditions = safeStr(extras.preconditions).trim()
    if ((!isUpdate || !changedFields || changedFields.has('preconditions')) && preconditions) body.precondition = preconditions

    const labels = Array.isArray(extras.labels)
        ? extras.labels.map((item) => safeStr(item).trim()).filter(Boolean)
        : []
    if ((!isUpdate || !changedFields || changedFields.has('labels')) && labels.length) body.labels = labels

    const customFields = normalizeCustomFields(extras.customFields)
    if (Object.keys(customFields).length) body.customFields = customFields

    const providerParameterMode = safeStr(extras.__parametersMode)
    const shouldIncludeParameters =
        !isUpdate ||
        !changedFields ||
        changedFields.has('steps') ||
        (changedFields.has('parameters') && providerParameterMode !== 'inferred')
    if (shouldIncludeParameters) {
        const parameters = normalizeParameters(extras.parameters, parameterMode)
        if ('variables' in parameters || 'entries' in parameters) body.parameters = parameters
    }

    if (!isUpdate || !changedFields || changedFields.has('steps')) {
        body.testScript = {
            type: 'STEP_BY_STEP',
            steps: (payload.steps ?? []).map((step) => ({
                description: safeStr(step.action || step.text).trim(),
                testData: safeStr(step.data).trim(),
                expectedResult: safeStr(step.expected).trim(),
            })),
        }
    }

    return body
}

function normalizeRemoteAttachments(values: ZephyrAttachmentResponse[] | undefined, scope: string) {
    if (!Array.isArray(values)) return []
    return values
        .map((value, index) => {
            const id = safeStr(value?.id ?? value?.attachmentId ?? `${scope}:${index + 1}`).trim()
            const name =
                safeStr(value?.name ?? value?.fileName ?? value?.filename ?? value?.title).trim() ||
                `attachment-${index + 1}`
            const pathOrDataUrl =
                safeStr(value?.downloadUrl ?? value?.content ?? value?.url ?? value?.href ?? value?.self).trim()
            return { id, name, pathOrDataUrl }
        })
        .filter((attachment): attachment is { id: string; name: string; pathOrDataUrl: string } => Boolean(attachment.name))
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}

function normalizeCustomFields(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => Boolean(String(key).trim()))
            .map(([key, item]) => [String(key).trim(), normalizeStructuredValue(item)])
    )
}

function normalizeParameters(value: unknown, mode: 'structured' | 'name-list'): { variables?: unknown[]; entries?: unknown[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const raw = value as Record<string, unknown>
    const next: { variables?: unknown[]; entries?: unknown[] } = {}
    const variables = 'variables' in raw ? normalizeParameterVariables(raw.variables, mode) : []
    const entries = 'entries' in raw && Array.isArray(raw.entries) ? raw.entries.map(normalizeStructuredValue) : []
    if (variables.length) next.variables = variables
    if (entries.length) next.entries = entries
    return next
}

function normalizeParameterVariables(value: unknown, mode: 'structured' | 'name-list'): unknown[] {
    if (!Array.isArray(value)) return []
    const names: string[] = []
    const structured: Record<string, unknown>[] = []

    for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
            const name = item.trim()
            names.push(name)
            structured.push({ name, defaultValue: '' })
            continue
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const raw = item as Record<string, unknown>
            const name = typeof raw.name === 'string' ? raw.name.trim() : ''
            if (!name) continue
            names.push(name)
            structured.push({
                ...Object.fromEntries(Object.entries(raw).map(([key, entry]) => [key, normalizeStructuredValue(entry)])),
                name,
                defaultValue: typeof raw.defaultValue === 'string' ? raw.defaultValue : '',
            })
        }
    }

    const uniqueNames = [...new Set(names)].sort((left, right) => left.localeCompare(right))
    if (mode === 'name-list') return uniqueNames

    const byName = new Map<string, Record<string, unknown>>()
    for (const item of structured) {
        const name = typeof item.name === 'string' ? item.name : ''
        if (!name || byName.has(name)) continue
        byName.set(name, item)
    }
    return [...byName.values()].sort((left, right) => String(left.name).localeCompare(String(right.name)))
}

function shouldRetryVariablePayload(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '')
    const normalized = message.toLowerCase()
    return normalized.includes('parameters.variables') || normalized.includes('cannot use variables')
}

function normalizeChangedFields(value: unknown): Set<string> | null {
    if (!Array.isArray(value)) return null
    const fields = value.map((item) => String(item).trim()).filter(Boolean)
    return fields.length ? new Set(fields) : null
}

function normalizeStructuredValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => normalizeStructuredValue(item))
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeStructuredValue(item)])
        )
    }
    return value
}
