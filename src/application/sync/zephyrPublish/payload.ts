import { mdToHtml, looksLikeHtml } from '@core/markdown'
import { buildExport } from '@core/export'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { nowISO, type RootState, type TestCase, type TestMeta } from '@core/domain'
import { mapTests } from '@core/tree'
import type { ProviderStep, ProviderTest } from '@providers/types'
import { copyAttachment, resolveZephyrExternalId, safeString } from './common'

type ZephyrPublishPayloadContext = {
    refCatalog: ReturnType<typeof buildRefCatalog>
}

export function createZephyrPublishPayloadContext(state: RootState): ZephyrPublishPayloadContext {
    return {
        refCatalog: buildRefCatalog(mapTests(state.root), state.sharedSteps),
    }
}

export function buildZephyrPublishPayload(
    test: TestCase,
    state: RootState,
    context: ZephyrPublishPayloadContext = createZephyrPublishPayloadContext(state)
): ProviderTest {
    const exportPayload = buildExport(test, state)
    const render = (value: string | undefined) => renderZephyrText(value, context.refCatalog)
    const externalId = resolveZephyrExternalId(test) ?? ''
    const projectKey = resolveProjectKey(test)
    const folder = safeString(test.meta?.params?.folder)
    const objective = render(test.meta?.objective)
    const preconditions = render(test.meta?.preconditions)
    const labels = (test.meta?.tags ?? []).map((item) => String(item).trim()).filter(Boolean)
    const customFields = buildPublishCustomFields(test.meta)
    const steps = exportPayload.steps.map((step) => ({
        action: render(step.action),
        data: render(step.data),
        expected: render(step.expected),
        text: render(step.action),
        attachments: (step.attachments ?? []).map(copyAttachment),
    }))
    const parametersInfo = buildPublishParameters(test.meta, steps)
    const parameters = parametersInfo.value

    return {
        id: externalId,
        name: test.name,
        description: render(exportPayload.description),
        steps,
        attachments: (exportPayload.attachments ?? []).map(copyAttachment),
        updatedAt: nowISO(),
        extras: {
            projectKey,
            folder,
            objective,
            preconditions,
            labels,
            ...(customFields ? { customFields } : {}),
            ...(parameters ? { parameters } : {}),
            __parametersMode: parametersInfo.mode,
        },
    }
}

function renderZephyrText(value: string | undefined, catalog: ReturnType<typeof buildRefCatalog>): string {
    const raw = String(value ?? '')
    if (!raw.trim()) return ''
    const resolved = renderRefsInText(raw, catalog, { mode: 'html' })
    return looksLikeHtml(resolved) ? normalizeZephyrHtmlText(resolved) : mdToHtml(resolved)
}

function normalizeZephyrHtmlText(value: string): string {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{2,}/g, '<br /><br />')
        .replace(/\n/g, '<br />')
}

function resolveProjectKey(test: TestCase): string | undefined {
    const explicit = safeString(test.meta?.params?.projectKey)
    if (explicit) return explicit
    const linked = resolveZephyrExternalId(test)
    const match = linked?.match(/^([A-Z][A-Z0-9_]+)-\d+$/)
    return match?.[1]
}

function buildPublishCustomFields(meta: TestMeta | undefined): Record<string, unknown> | undefined {
    const params = meta?.params ?? {}
    const entries = Object.entries(params)
        .filter(([key]) => key.startsWith('customFields.'))
        .map(([key, value]) => [key.slice('customFields.'.length), parseStoredParamValue(value)] as const)
        .filter(([key]) => Boolean(key.trim()))

    const next = Object.fromEntries(entries) as Record<string, unknown>
    const fallbackFields: Array<[string, unknown]> = [
        ['Automation', meta?.automation],
        ['Test Type', meta?.testType],
        ['Assigned to', meta?.assignedTo],
    ]

    for (const [key, value] of fallbackFields) {
        if (next[key] !== undefined) continue
        const normalized = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
        if (!normalized) continue
        next[key] = normalized
    }

    if (!Object.keys(next).length) return undefined
    return next
}

function buildPublishParameters(
    meta: TestMeta | undefined,
    _steps: ProviderStep[]
): {
    value?: { variables?: unknown[]; entries?: unknown[] }
    mode: 'none' | 'explicit'
} {
    const params = meta?.params ?? {}
    const hasVariables = Object.prototype.hasOwnProperty.call(params, 'parameters.variables')
    const hasEntries = Object.prototype.hasOwnProperty.call(params, 'parameters.entries')
    if (!hasVariables && !hasEntries) return { mode: 'none' }

    const next: { variables?: unknown[]; entries?: unknown[] } = {}
    const existingVariables = hasVariables ? normalizeParameterVariableList(parseStoredArrayValue(params['parameters.variables'])) : []
    if (existingVariables.length) next.variables = existingVariables
    const entries = hasEntries ? parseStoredArrayValue(params['parameters.entries']) : []
    if (entries.length) next.entries = entries
    const mode = existingVariables.length > 0 || entries.length > 0 ? 'explicit' : 'none'
    return Object.keys(next).length ? { value: next, mode } : { mode }
}

function parseStoredParamValue(value: string | undefined): unknown {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function parseStoredArrayValue(value: string | undefined): unknown[] {
    const parsed = parseStoredParamValue(value)
    return Array.isArray(parsed) ? parsed : []
}

function normalizeParameterVariableList(values: unknown[]): Array<{ name: string; [key: string]: unknown }> {
    const normalized: Array<{ name: string; [key: string]: unknown }> = []
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            normalized.push({ name: value.trim(), defaultValue: '' })
            continue
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const rawName = (value as Record<string, unknown>).name
            const name = typeof rawName === 'string' ? rawName.trim() : ''
            if (!name) continue
            normalized.push({
                ...(value as Record<string, unknown>),
                name,
                defaultValue:
                    typeof (value as Record<string, unknown>).defaultValue === 'string'
                        ? String((value as Record<string, unknown>).defaultValue)
                        : '',
            })
        }
    }
    return normalized
}
