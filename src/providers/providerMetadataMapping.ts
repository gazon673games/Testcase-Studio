import type { TestMeta } from '@core/domain'
import type { ProviderTest, ProviderTestExtras } from '@providers/types'

function toOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return value == null ? undefined : String(value)
    const normalized = value.trim()
    return normalized ? normalized : undefined
}

function normalizeIssueLinks(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined
    const items = value
        .map((item) => toOptionalString(item))
        .filter((item): item is string => Boolean(item))
    return items.length ? items : undefined
}

function normalizeCustomFields(providerMetadata: ProviderTestExtras): Record<string, unknown> | undefined {
    const fields = providerMetadata.customFields
    if (!fields || typeof fields !== 'object') return undefined
    const next = Object.fromEntries(Object.entries(fields))
    return Object.keys(next).length ? next : undefined
}

function normalizeParameters(providerMetadata: ProviderTestExtras) {
    const parameters = providerMetadata.parameters
    if (!parameters || typeof parameters !== 'object') return undefined

    const variables = Array.isArray(parameters.variables) ? [...parameters.variables] : undefined
    const entries = Array.isArray(parameters.entries) ? [...parameters.entries] : undefined
    if (!variables?.length && !entries?.length) return undefined

    return {
        ...(variables?.length ? { variables } : {}),
        ...(entries?.length ? { entries } : {}),
    }
}

function compactObject<T extends Record<string, unknown>>(value: T): T | undefined {
    return Object.values(value).some((item) => item !== undefined) ? value : undefined
}

export function buildTestDetailsFromProviderTest(src: ProviderTest): TestMeta {
    const providerMetadata = src.extras ?? {}
    const customFields = normalizeCustomFields(providerMetadata)

    return {
        tags: [],
        attributes: {},
        params: {},
        objective: toOptionalString(providerMetadata.objective),
        preconditions: toOptionalString(providerMetadata.preconditions),
        status: toOptionalString(providerMetadata.status),
        priority: toOptionalString(providerMetadata.priority),
        component: toOptionalString(providerMetadata.component),
        owner: toOptionalString(providerMetadata.owner),
        folder: toOptionalString(providerMetadata.folder),
        publication: compactObject({
            type: toOptionalString(customFields?.['Test Type']),
            automation: toOptionalString(customFields?.Automation),
            assignedTo: toOptionalString(customFields?.['Assigned to']),
        }),
        external: compactObject({
            key: toOptionalString(providerMetadata.key),
            keyNumber: toOptionalString(providerMetadata.keyNumber),
            projectKey: toOptionalString(providerMetadata.projectKey),
            latestVersion: typeof providerMetadata.latestVersion === 'boolean' ? providerMetadata.latestVersion : undefined,
            lastTestResultStatus: toOptionalString(providerMetadata.lastTestResultStatus),
            updatedBy: toOptionalString(providerMetadata.updatedBy),
            createdBy: toOptionalString(providerMetadata.createdBy),
            createdOn: toOptionalString(providerMetadata.createdOn),
            updatedOn: toOptionalString(providerMetadata.updatedOn),
            issueLinks: normalizeIssueLinks(providerMetadata.issueLinks),
            customFields,
            parameters: normalizeParameters(providerMetadata),
        }),
    }
}

export const buildMetaFromProviderTest = buildTestDetailsFromProviderTest
