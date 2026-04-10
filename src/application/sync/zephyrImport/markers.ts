import { nowISO, type TestCase, type TestMeta } from '@core/domain'
import { stableJson, safeString } from './shared'

export const IMPORT_SIGNATURE_KEY = '__zephyrImport.signature'
export const IMPORT_META_KEYS_KEY = '__zephyrImport.metaKeys'
export const IMPORT_REMOTE_UPDATED_AT_KEY = '__zephyrImport.remoteUpdatedAt'
export const IMPORT_IMPORTED_AT_KEY = '__zephyrImport.importedAt'
export const IMPORT_REMOTE_KEY_KEY = '__zephyrImport.remoteKey'
export const IMPORT_CONFLICT_REMOTE_KEY = '__zephyrImport.conflictRemoteKey'
export const IMPORT_CONFLICT_LOCAL_ID = '__zephyrImport.conflictLocalId'

export function buildImportManagedSignature(test: TestCase, metaKeys: string[]): string {
    const details = test.meta ?? test.details
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
                action: collectPartSignature(step.presentation?.parts?.action ?? step.internal?.parts?.action),
                data: collectPartSignature(step.presentation?.parts?.data ?? step.internal?.parts?.data),
                expected: collectPartSignature(step.presentation?.parts?.expected ?? step.internal?.parts?.expected),
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
                type: details?.publication?.type ?? '',
                automation: details?.publication?.automation ?? '',
                assignedTo: details?.publication?.assignedTo ?? '',
            },
            external: {
                key: details?.external?.key ?? '',
                keyNumber: details?.external?.keyNumber ?? '',
                projectKey: details?.external?.projectKey ?? '',
                updatedOn: details?.external?.updatedOn ?? '',
                customFields: details?.external?.customFields ?? {},
                parameters: details?.external?.parameters ?? {},
            },
            attributes: Object.fromEntries(metaKeys.map((key) => [key, details?.attributes?.[key] ?? details?.params?.[key] ?? ''])),
        },
    })
}

export function getManagedMetaKeys(test: Pick<TestCase, 'meta' | 'details'> | undefined): string[] {
    const details = test?.meta ?? test?.details
    return Object.keys(details?.attributes ?? details?.params ?? {})
        .filter((key) => !isImportMarkerKey(key))
        .sort((left, right) => left.localeCompare(right))
}

export function getImportSignature(test: Pick<TestCase, 'meta' | 'details'> | undefined): string | undefined {
    const details = test?.meta ?? test?.details
    return safeString(details?.attributes?.[IMPORT_SIGNATURE_KEY] ?? details?.params?.[IMPORT_SIGNATURE_KEY])
}

export function getImportMetaKeys(test: Pick<TestCase, 'meta' | 'details'> | undefined): string[] | undefined {
    const details = test?.meta ?? test?.details
    const raw = safeString(details?.attributes?.[IMPORT_META_KEYS_KEY] ?? details?.params?.[IMPORT_META_KEYS_KEY])
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map((value) => String(value)).sort((left, right) => left.localeCompare(right)) : undefined
    } catch {
        return undefined
    }
}

export function applyImportMarkers(
    meta: TestMeta | undefined,
    payload: { signature: string; metaKeys: string[]; remoteKey: string; remoteUpdatedAt?: string }
) {
    if (!meta) return
    meta.attributes = meta.attributes ?? meta.params ?? {}
    meta.params = meta.attributes
    meta.attributes[IMPORT_SIGNATURE_KEY] = payload.signature
    meta.attributes[IMPORT_META_KEYS_KEY] = JSON.stringify(payload.metaKeys)
    meta.attributes[IMPORT_REMOTE_KEY_KEY] = payload.remoteKey
    meta.attributes[IMPORT_IMPORTED_AT_KEY] = nowISO()
    if (payload.remoteUpdatedAt) meta.attributes[IMPORT_REMOTE_UPDATED_AT_KEY] = payload.remoteUpdatedAt
    else delete meta.attributes[IMPORT_REMOTE_UPDATED_AT_KEY]
}

export function buildImportedMeta(
    existing: TestMeta | undefined,
    incoming: TestMeta | undefined,
    previousImportedKeys: string[],
    nextImportedKeys: string[],
    remoteUpdatedAt: string | undefined
): TestMeta {
    const existingAttributes = existing?.attributes ?? existing?.params ?? {}
    const incomingAttributes = incoming?.attributes ?? incoming?.params ?? {}
    const preserved: Record<string, string> = {}

    for (const [key, value] of Object.entries(existingAttributes)) {
        if (isImportMarkerKey(key)) continue
        if (previousImportedKeys.includes(key)) continue
        if (nextImportedKeys.includes(key)) continue
        preserved[key] = value
    }

    const nextExternal = {
        ...(existing?.external ?? {}),
        ...(incoming?.external ?? {}),
        ...(remoteUpdatedAt ? { updatedOn: String(remoteUpdatedAt) } : {}),
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
        publication: incoming?.publication ?? existing?.publication,
        external: Object.values(nextExternal).some((value) => value !== undefined) ? nextExternal : undefined,
        attributes: {
            ...preserved,
            ...incomingAttributes,
        },
        params: {
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
