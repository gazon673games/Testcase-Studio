export type SyncMessageKey =
    | 'defaults.root'
    | 'import.conflictFolder'
    | 'import.reason.multipleMatches'
    | 'import.reason.newLocal'
    | 'import.reason.matchesRemote'
    | 'import.reason.remoteChanged'
    | 'import.reason.onlyLocalChanged'
    | 'import.reason.bothChanged'
    | 'import.reason.noBaseline'
    | 'import.diff.name'
    | 'import.diff.description'
    | 'import.diff.steps'
    | 'import.diff.meta'
    | 'import.diff.attachments'
    | 'import.diff.folder'
    | 'import.diff.newLocal'
    | 'import.diff.noLocal'
    | 'import.diff.willCreate'
    | 'import.summary.objective'
    | 'import.summary.preconditions'
    | 'import.summary.params'
    | 'import.summary.noMeta'
    | 'import.summary.attachments'
    | 'import.summary.noAttachments'
    | 'publish.warning.attachmentsUpload'
    | 'publish.warning.attachmentsDelete'
    | 'publish.summary.noAttachments'
    | 'publish.summary.attachments'
    | 'publish.summary.noCustomFields'
    | 'publish.summary.noParameters'
    | 'publish.summary.noLabels'
    | 'publish.diff.name'
    | 'publish.diff.description'
    | 'publish.diff.steps'
    | 'publish.diff.objective'
    | 'publish.diff.preconditions'
    | 'publish.diff.attachments'
    | 'publish.diff.folder'
    | 'publish.diff.noFolder'
    | 'publish.diff.labels'
    | 'publish.diff.customFields'
    | 'publish.diff.parameters'
    | 'publish.diff.noRemote'
    | 'publish.reason.missingProjectKey'
    | 'publish.reason.create'
    | 'publish.reason.remoteLoadFailed'
    | 'publish.reason.remoteUnavailable'
    | 'publish.reason.skip'
    | 'publish.reason.update'

export type SyncTranslate = (key: SyncMessageKey, params?: Record<string, string | number>) => string

export type SyncText = {
    rootLabel: string
    t: SyncTranslate
}

export function createSyncText(t: SyncTranslate): SyncText {
    return {
        rootLabel: t('defaults.root'),
        t,
    }
}
