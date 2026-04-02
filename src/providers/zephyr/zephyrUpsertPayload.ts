import type { ProviderTest } from '../types'
import { normalizeCustomFields, normalizeParameters, safeStr } from './zephyrValueMapping'

type ParameterMode = 'structured' | 'name-list'

export function buildUpsertBodies(payload: ProviderTest, isUpdate: boolean) {
    const primaryBody = buildUpsertBody(payload, 'structured', isUpdate)
    const fallbackBody = buildUpsertBody(payload, 'name-list', isUpdate)
    const seenSignatures = new Set<string>()

    return [primaryBody, fallbackBody].filter((body) => {
        const signature = JSON.stringify(body)
        if (seenSignatures.has(signature)) return false
        seenSignatures.add(signature)
        return true
    })
}

export function buildUpsertBody(
    payload: ProviderTest,
    parameterMode: ParameterMode = 'structured',
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
