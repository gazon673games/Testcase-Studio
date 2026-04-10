import { nowISO, type TestCase, type TestDetails } from '@core/domain'
import {
    getZephyrStepIntegration,
    getZephyrTestIntegration,
    setZephyrTestIntegration,
    type ZephyrTestIntegration,
} from '@providers/zephyr/zephyrModel'
import { stableJson, safeString } from './shared'

export const IMPORT_SIGNATURE_KEY = '__zephyrImport.signature'
export const IMPORT_META_KEYS_KEY = '__zephyrImport.metaKeys'
export const IMPORT_REMOTE_UPDATED_AT_KEY = '__zephyrImport.remoteUpdatedAt'
export const IMPORT_IMPORTED_AT_KEY = '__zephyrImport.importedAt'
export const IMPORT_REMOTE_KEY_KEY = '__zephyrImport.remoteKey'
export const IMPORT_CONFLICT_REMOTE_KEY = '__zephyrImport.conflictRemoteKey'
export const IMPORT_CONFLICT_LOCAL_ID = '__zephyrImport.conflictLocalId'

export function buildImportManagedSignature(test: TestCase, metaKeys: string[]): string {
    const details = test.details
    const zephyr = getZephyrTestIntegration(test)
    return stableJson({
        name: test.name ?? '',
        description: test.description ?? '',
        steps: (test.steps ?? []).map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
            text: step.text ?? '',
            providerStepId: step.source?.sourceStepId ?? '',
            usesShared: step.usesShared ?? '',
            attachments: collectAttachmentSignature(step.attachments ?? []),
            parts: {
                action: collectPartSignature(step.presentation?.parts?.action),
                data: collectPartSignature(step.presentation?.parts?.data),
                expected: collectPartSignature(step.presentation?.parts?.expected),
            },
        })),
        attachments: (test.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            pathOrDataUrl: attachment.pathOrDataUrl,
        })),
        meta: {
            objective: details?.objective ?? '',
            preconditions: details?.preconditions ?? '',
            publication: {
                type: zephyr?.publication?.type ?? '',
                automation: zephyr?.publication?.automation ?? '',
                assignedTo: zephyr?.publication?.assignedTo ?? '',
            },
            external: {
                key: zephyr?.remote?.key ?? '',
                keyNumber: zephyr?.remote?.keyNumber ?? '',
                projectKey: zephyr?.remote?.projectKey ?? '',
                updatedOn: zephyr?.remote?.updatedOn ?? '',
                customFields: zephyr?.remote?.customFields ?? {},
                parameters: zephyr?.remote?.parameters ?? {},
            },
            attributes: Object.fromEntries(metaKeys.map((key) => [key, details?.attributes?.[key] ?? ''])),
        },
    })
}

export function getManagedMetaKeys(test: Pick<TestCase, 'details'> | undefined): string[] {
    const details = test?.details
    return Object.keys(details?.attributes ?? {})
        .sort((left, right) => left.localeCompare(right))
}

export function getImportSignature(test: Pick<TestCase, 'integration'> | undefined): string | undefined {
    return safeString(getZephyrTestIntegration(test as TestCase)?.importState?.signature)
}

export function getImportMetaKeys(test: Pick<TestCase, 'integration'> | undefined): string[] | undefined {
    const keys = getZephyrTestIntegration(test as TestCase)?.importState?.managedAttributeKeys
    return Array.isArray(keys) ? [...keys].sort((left, right) => left.localeCompare(right)) : undefined
}

export function applyImportMarkers(
    test: TestCase,
    payload: { signature: string; metaKeys: string[]; remoteKey: string; remoteUpdatedAt?: string }
) {
    const currentZephyr = getZephyrTestIntegration(test)
    setZephyrTestIntegration(test, {
        ...(currentZephyr ?? {}),
        remote: {
            ...(currentZephyr?.remote ?? {}),
            key: payload.remoteKey,
            ...(payload.remoteUpdatedAt ? { updatedOn: payload.remoteUpdatedAt } : {}),
        },
        importState: {
            signature: payload.signature,
            managedAttributeKeys: [...payload.metaKeys],
            remoteKey: payload.remoteKey,
            remoteUpdatedAt: payload.remoteUpdatedAt,
            importedAt: nowISO(),
            conflictRemoteKey: currentZephyr?.importState?.conflictRemoteKey,
            conflictLocalId: currentZephyr?.importState?.conflictLocalId,
        },
    })
}

export function buildImportedMeta(
    existing: TestDetails | undefined,
    incoming: TestDetails | undefined,
    previousImportedKeys: string[],
    nextImportedKeys: string[],
): TestDetails {
    const existingAttributes = existing?.attributes ?? {}
    const incomingAttributes = incoming?.attributes ?? {}
    const preserved: Record<string, string> = {}

    for (const [key, value] of Object.entries(existingAttributes)) {
        if (isImportMarkerKey(key)) continue
        if (previousImportedKeys.includes(key)) continue
        if (nextImportedKeys.includes(key)) continue
        preserved[key] = value
    }

    return {
        ...(existing ?? { tags: [] }),
        tags: existing?.tags ?? [],
        objective: incoming?.objective,
        preconditions: incoming?.preconditions,
        status: incoming?.status ?? existing?.status,
        priority: incoming?.priority ?? existing?.priority,
        component: incoming?.component ?? existing?.component,
        owner: incoming?.owner ?? existing?.owner,
        folder: incoming?.folder ?? existing?.folder,
        estimated: existing?.estimated,
        attributes: {
            ...preserved,
            ...incomingAttributes,
        },
    }
}

export function isImportMarkerKey(key: string): boolean {
    return key.startsWith('__zephyrImport.')
}

function collectPartSignature(parts: Array<{ id?: string; text?: string; export?: boolean }> | undefined) {
    return (parts ?? []).map((part) => ({
        id: String(part.id ?? ''),
        text: String(part.text ?? ''),
        export: part.export !== false,
    }))
}

function collectAttachmentSignature(attachments: Array<{ name?: string; pathOrDataUrl?: string }> | undefined) {
    return (attachments ?? []).map((attachment) => ({
        name: String(attachment.name ?? ''),
        pathOrDataUrl: String(attachment.pathOrDataUrl ?? ''),
    }))
}
