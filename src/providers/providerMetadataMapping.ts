import type { TestMeta } from '@core/domain'
import type { ProviderTest } from '@providers/types'

function putParam(target: Record<string, string>, key: string, value: unknown) {
    if (value === undefined || value === null) return

    if (Array.isArray(value) || typeof value === 'object') {
        target[key] = JSON.stringify(value)
        return
    }

    target[key] = String(value)
}

export function buildMetaFromProviderTest(src: ProviderTest): TestMeta {
    const params: Record<string, string> = {}
    const extras = src.extras ?? {}

    putParam(params, 'key', (extras as any).key)
    putParam(params, 'keyNumber', (extras as any).keyNumber)
    putParam(params, 'status', (extras as any).status)
    putParam(params, 'priority', (extras as any).priority)
    putParam(params, 'component', (extras as any).component)
    putParam(params, 'projectKey', (extras as any).projectKey)
    putParam(params, 'folder', (extras as any).folder)
    putParam(params, 'latestVersion', (extras as any).latestVersion)
    putParam(params, 'lastTestResultStatus', (extras as any).lastTestResultStatus)
    putParam(params, 'owner', (extras as any).owner)
    putParam(params, 'updatedBy', (extras as any).updatedBy)
    putParam(params, 'createdBy', (extras as any).createdBy)
    putParam(params, 'createdOn', (extras as any).createdOn)
    putParam(params, 'updatedOn', (extras as any).updatedOn)
    putParam(params, 'issueLinks', (extras as any).issueLinks)

    const customFields = (extras as any).customFields as Record<string, unknown> | undefined
    if (customFields && typeof customFields === 'object') {
        for (const [key, value] of Object.entries(customFields)) {
            putParam(params, `customFields.${key}`, value)
        }
    }

    const parameters = (extras as any).parameters as { variables?: unknown[]; entries?: unknown[] } | undefined
    if (parameters && typeof parameters === 'object') {
        if ('variables' in parameters) putParam(params, 'parameters.variables', parameters.variables ?? [])
        if ('entries' in parameters) putParam(params, 'parameters.entries', parameters.entries ?? [])
    }

    const objective = (extras as any).objective
    const preconditions = (extras as any).preconditions

    return {
        tags: [],
        params,
        objective: objective == null ? undefined : String(objective),
        preconditions: preconditions == null ? undefined : String(preconditions),
    }
}
