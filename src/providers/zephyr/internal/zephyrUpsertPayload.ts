import type { ProviderTest } from '../../types'
import { looksLikeHtml } from '@core/markdown'
import { normalizeCustomFields, normalizeParameters, safeStr, type VariableTypePolicy } from './zephyrValueMapping'

export function buildUpsertBodies(payload: ProviderTest, isUpdate: boolean) {
    const policies: VariableTypePolicy[] = ['zephyr-text', 'zephyr-string', 'legacy-lowercase']
    const seenSignatures = new Set<string>()

    return policies
        .map((policy) => buildUpsertBody(payload, isUpdate, policy))
        .filter((body) => {
            const signature = JSON.stringify(body)
            if (seenSignatures.has(signature)) return false
            seenSignatures.add(signature)
            return true
        })
}

export function buildUpsertBody(
    payload: ProviderTest,
    isUpdate = false,
    variableTypePolicy: VariableTypePolicy = 'zephyr-text'
) {
    const extras = payload.extras ?? {}
    const changedFields = normalizeChangedFields(extras.__changedFields)
    const body: Record<string, unknown> = {
        name: safeStr(payload.name),
    }

    const projectKey = safeStr(extras.projectKey).trim()
    if (projectKey) body.projectKey = projectKey

    const description = normalizeZephyrRequestText(safeStr(payload.description).trim())
    if (!isUpdate || !changedFields || changedFields.has('description')) {
        if (description) body.description = description
    }

    const folder = safeStr(extras.folder).trim()
    if ((!isUpdate || !changedFields || changedFields.has('folder')) && folder) body.folder = folder

    const objective = normalizeZephyrRequestText(safeStr(extras.objective).trim())
    if ((!isUpdate || !changedFields || changedFields.has('objective')) && objective) body.objective = objective

    const preconditions = normalizeZephyrRequestText(safeStr(extras.preconditions).trim())
    if ((!isUpdate || !changedFields || changedFields.has('preconditions')) && preconditions) body.precondition = preconditions

    const labels = Array.isArray(extras.labels)
        ? extras.labels.map((item) => safeStr(item).trim()).filter(Boolean)
        : []
    if ((!isUpdate || !changedFields || changedFields.has('labels')) && labels.length) body.labels = labels

    const customFields = normalizeCustomFields(extras.customFields)
    if (Object.keys(customFields).length) body.customFields = customFields

    const shouldIncludeParameters =
        !isUpdate ||
        !changedFields ||
        changedFields.has('steps') ||
        changedFields.has('parameters')

    if (shouldIncludeParameters) {
        const parameters = normalizeParameters(extras.parameters, variableTypePolicy)
        if ('variables' in parameters || 'entries' in parameters) body.parameters = parameters
    }

    if (!isUpdate || !changedFields || changedFields.has('steps')) {
        body.testScript = {
            type: 'STEP_BY_STEP',
            steps: (payload.steps ?? []).map((step) => ({
                description: normalizeZephyrRequestText(safeStr(step.action || step.text).trim()),
                testData: normalizeZephyrRequestText(safeStr(step.data).trim()),
                expectedResult: normalizeZephyrRequestText(safeStr(step.expected).trim()),
            })),
        }
    }

    return body
}

function normalizeZephyrRequestText(value: string): string {
    if (!value) return ''
    if (!looksLikeHtml(value)) return value
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\n{2,}/g, '<br /><br />')
        .replace(/\n/g, '<br />')
}

export function shouldRetryVariablePayload(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '')
    const normalized = message.toLowerCase()
    return normalized.includes('parameters.variables') || normalized.includes('cannot use variables')
}

export function normalizeChangedFields(value: unknown): Set<string> | null {
    if (!Array.isArray(value)) return null
    const fields = value.map((item) => String(item).trim()).filter(Boolean)
    return fields.length ? new Set(fields) : null
}
