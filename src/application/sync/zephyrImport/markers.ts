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
    return stableJson({
        name: test.name ?? '',
        description: test.description ?? '',
        steps: (test.steps ?? []).map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
            text: step.text ?? '',
            providerStepId: step.raw?.providerStepId ?? '',
            usesShared: step.usesShared ?? '',
            attachments: collectAttachmentSignature(step.attachments ?? []),
            parts: {
                action: collectPartSignature(step.internal?.parts?.action),
                data: collectPartSignature(step.internal?.parts?.data),
                expected: collectPartSignature(step.internal?.parts?.expected),
            },
        })),
        attachments: (test.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            pathOrDataUrl: attachment.pathOrDataUrl,
        })),
        meta: {
            objective: test.meta?.objective ?? '',
            preconditions: test.meta?.preconditions ?? '',
            params: Object.fromEntries(metaKeys.map((key) => [key, test.meta?.params?.[key] ?? ''])),
        },
    })
}

export function getManagedMetaKeys(test: Pick<TestCase, 'meta'> | undefined): string[] {
    return Object.keys(test?.meta?.params ?? {})
        .filter((key) => !isImportMarkerKey(key))
        .sort((left, right) => left.localeCompare(right))
}

export function getImportSignature(test: Pick<TestCase, 'meta'> | undefined): string | undefined {
    return safeString(test?.meta?.params?.[IMPORT_SIGNATURE_KEY])
}

export function getImportMetaKeys(test: Pick<TestCase, 'meta'> | undefined): string[] | undefined {
    const raw = safeString(test?.meta?.params?.[IMPORT_META_KEYS_KEY])
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
    meta.params = meta.params ?? {}
    meta.params[IMPORT_SIGNATURE_KEY] = payload.signature
    meta.params[IMPORT_META_KEYS_KEY] = JSON.stringify(payload.metaKeys)
    meta.params[IMPORT_REMOTE_KEY_KEY] = payload.remoteKey
    meta.params[IMPORT_IMPORTED_AT_KEY] = nowISO()
    if (payload.remoteUpdatedAt) meta.params[IMPORT_REMOTE_UPDATED_AT_KEY] = payload.remoteUpdatedAt
    else delete meta.params[IMPORT_REMOTE_UPDATED_AT_KEY]
}

export function buildImportedMeta(
    existing: TestMeta | undefined,
    incoming: TestMeta | undefined,
    previousImportedKeys: string[],
    nextImportedKeys: string[],
    remoteUpdatedAt: string | undefined
): TestMeta {
    const existingParams = existing?.params ?? {}
    const incomingParams = incoming?.params ?? {}
    const preserved: Record<string, string> = {}

    for (const [key, value] of Object.entries(existingParams)) {
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
        params: {
            ...preserved,
            ...incomingParams,
            ...(remoteUpdatedAt ? { updatedOn: String(remoteUpdatedAt) } : {}),
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
