import { mdToHtml, looksLikeHtml } from '@core/markdown'
import { buildExport } from '@core/export'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { nowISO, type RootState, type TestCase, type TestMeta } from '@core/domain'
import { mapTests } from '@core/tree'
import type { ProviderStep, ProviderTest } from '@providers/types'
import { copyAttachment, resolveZephyrExternalId, safeString } from './common'

export function buildZephyrPublishPayload(test: TestCase, state: RootState): ProviderTest {
    const exportPayload = buildExport(test, state)
    const refCatalog = buildRefCatalog(mapTests(state.root), state.sharedSteps)
    const render = (value: string | undefined) => renderZephyrText(value, refCatalog)
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
    return looksLikeHtml(resolved) ? resolved : mdToHtml(resolved)
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

    if (!entries.length) return undefined
    return Object.fromEntries(entries)
}

function buildPublishParameters(
    meta: TestMeta | undefined,
    steps: ProviderStep[]
): {
    value?: { variables?: unknown[]; entries?: unknown[] }
    mode: 'none' | 'explicit' | 'inferred' | 'mixed'
} {
    const params = meta?.params ?? {}
    const hasVariables = Object.prototype.hasOwnProperty.call(params, 'parameters.variables')
    const hasEntries = Object.prototype.hasOwnProperty.call(params, 'parameters.entries')
    const inferredVariables = inferStepVariables(steps)
    if (!hasVariables && !hasEntries && inferredVariables.length === 0) return { mode: 'none' }

    const next: { variables?: unknown[]; entries?: unknown[] } = {}
    const existingVariables = hasVariables ? normalizeParameterVariableList(parseStoredArrayValue(params['parameters.variables'])) : []
    const mergedVariables = mergeParameterVariables(existingVariables, inferredVariables)
    if (hasVariables || mergedVariables.length) next.variables = mergedVariables
    const entries = hasEntries ? parseStoredArrayValue(params['parameters.entries']) : []
    if (entries.length) next.entries = entries
    const hasExplicitData = existingVariables.length > 0 || entries.length > 0
    const hasInferredData = inferredVariables.length > 0
    const mode =
        hasExplicitData && hasInferredData
            ? 'mixed'
            : hasExplicitData
                ? 'explicit'
                : hasInferredData
                    ? 'inferred'
                    : 'none'
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

function inferStepVariables(steps: ProviderStep[]): Array<{ name: string; defaultValue: string }> {
    const found = new Set<string>()
    for (const step of steps) {
        for (const field of [step.action, step.data, step.expected]) {
            for (const name of collectVariableNamesFromText(field)) {
                for (const alias of expandVariableAliases(name)) found.add(alias)
            }
        }
    }
    return [...found].sort((left, right) => left.localeCompare(right)).map((name) => ({ name, defaultValue: '' }))
}

function collectVariableNamesFromText(value: string | undefined): string[] {
    const text = String(value ?? '')
    if (!text) return []

    const found = new Set<string>()

    for (const match of text.matchAll(/\{\{\s*([$\p{L}_][\p{L}\p{N}_.$-]*)\s*\}\}/gu)) {
        const name = match[1]?.trim()
        if (name) found.add(name)
    }

    for (const match of text.matchAll(/(^|[^{])\{\s*([$\p{L}_][\p{L}\p{N}_.$-]*)\s*\}(?!\})/gu)) {
        const name = match[2]?.trim()
        if (name) found.add(name)
    }

    return [...found]
}

function expandVariableAliases(name: string): string[] {
    const trimmed = name.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('$') && trimmed.length > 1) return [trimmed, trimmed.slice(1)]
    return [trimmed]
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

function mergeParameterVariables(
    existing: Array<{ name: string; [key: string]: unknown }>,
    inferred: Array<{ name: string; defaultValue: string }>
): Array<{ name: string; [key: string]: unknown }> {
    const byName = new Map<string, { name: string; [key: string]: unknown }>()
    for (const item of existing) byName.set(item.name, item)
    for (const item of inferred) {
        if (!byName.has(item.name)) byName.set(item.name, item)
    }
    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name))
}
