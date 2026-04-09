import type { PreviewStepDiffRow } from '@core/previewDiff'
import type { ProviderTest } from '@providers/types'

export type ZephyrImportMode = 'project' | 'folder' | 'keys'
export type ZephyrImportStrategy = 'replace' | 'skip' | 'merge-locally-later'
export type ZephyrImportStatus = 'new' | 'unchanged' | 'update' | 'conflict'
export type ZephyrImportDiffField = 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'folder'

export interface ZephyrImportRequest {
    mode: ZephyrImportMode
    destinationFolderId: string
    projectKey?: string
    folder?: string
    refs?: string[]
    rawQuery?: string
    maxResults?: number
    mirrorRemoteFolders?: boolean
}

export interface ZephyrImportDiff {
    field: ZephyrImportDiffField
    label: string
    local: string
    remote: string
    stepRows?: PreviewStepDiffRow[]
}

export interface ZephyrImportPreviewItem {
    id: string
    remote: ProviderTest
    remoteId: string
    remoteName: string
    remoteFolder?: string
    localTestId?: string
    localName?: string
    localFolder?: string
    localMatchIds: string[]
    status: ZephyrImportStatus
    reason: string
    strategy: ZephyrImportStrategy
    replaceDisabled?: boolean
    targetFolderSegments: string[]
    targetFolderLabel: string
    diffs: ZephyrImportDiff[]
}

export interface ZephyrImportPreview {
    request: ZephyrImportRequest
    query: string
    destinationFolderId: string
    destinationFolderLabel: string
    generatedAt: string
    items: ZephyrImportPreviewItem[]
    summary: {
        total: number
        created: number
        unchanged: number
        updates: number
        conflicts: number
    }
}

export interface ZephyrImportApplyResult {
    created: number
    createdTestIds: string[]
    updated: number
    updatedTestIds: string[]
    skipped: number
    drafts: number
    unchanged: number
}
