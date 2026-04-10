import { mdToHtml, looksLikeHtml } from '@core/markdown'
import { buildExport } from '@core/export'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { nowISO, type RootState, type TestCase, type TestDetails } from '@core/domain'
import { mapTests } from '@core/tree'
import type { ProviderStep, ProviderTest } from '@providers/types'
import { getZephyrTestIntegration } from '@providers/zephyr/zephyrModel'
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
    const details = test.details
    const zephyr = getZephyrTestIntegration(test)
    const exportPayload = buildExport(test, state)
    const render = (value: string | undefined) => renderZephyrText(value, context.refCatalog)
    const externalId = resolveZephyrExternalId(test) ?? ''
    const projectKey = resolveProjectKey(test)
    const folder = safeString(details?.folder)
    const objective = render(details?.objective)
    const preconditions = render(details?.preconditions)
    const labels = (details?.tags ?? []).map((item) => String(item).trim()).filter(Boolean)
    const customFields = buildPublishCustomFields(zephyr)
    const steps = exportPayload.steps.map((step) => ({
        action: render(step.action),
        data: render(step.data),
        expected: render(step.expected),
        text: render(step.action),
        attachments: (step.attachments ?? []).map(copyAttachment),
    }))
    const parametersInfo = buildPublishParameters(zephyr, steps)
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
    const explicit = safeString(getZephyrTestIntegration(test)?.remote?.projectKey)
    if (explicit) return explicit
    const linked = resolveZephyrExternalId(test)
    const match = linked?.match(/^([A-Z][A-Z0-9_]+)-\d+$/)
    return match?.[1]
}

function buildPublishCustomFields(zephyr: ReturnType<typeof getZephyrTestIntegration>): Record<string, unknown> | undefined {
    const next = {
        ...(zephyr?.remote?.customFields ?? {}),
    } as Record<string, unknown>

    const fallbackFields: Array<[string, unknown]> = [
        ['Automation', zephyr?.publication?.automation],
        ['Test Type', zephyr?.publication?.type],
        ['Assigned to', zephyr?.publication?.assignedTo],
    ]

    for (const [key, value] of fallbackFields) {
        if (next[key] !== undefined) continue
        const normalized = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
        if (!normalized) continue
        next[key] = normalized
    }

    return Object.keys(next).length ? next : undefined
}

function buildPublishParameters(
    zephyr: ReturnType<typeof getZephyrTestIntegration>,
    _steps: ProviderStep[]
): {
    value?: { variables?: unknown[]; entries?: unknown[] }
    mode: 'none' | 'explicit'
} {
    const explicitVariables = normalizeParameterVariableList(zephyr?.remote?.parameters?.variables ?? [])
    const explicitEntries = Array.isArray(zephyr?.remote?.parameters?.entries) ? [...(zephyr?.remote?.parameters?.entries ?? [])] : []
    if (explicitVariables.length || explicitEntries.length) {
        return {
            value: {
                ...(explicitVariables.length ? { variables: explicitVariables } : {}),
                ...(explicitEntries.length ? { entries: explicitEntries } : {}),
            },
            mode: 'explicit',
        }
    }
    return { mode: 'none' }
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
