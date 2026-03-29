import type { Attachment } from '@core/domain'
import type { PreviewStepDiffRow } from '@core/previewDiff'
import type { ProviderTest } from '@providers/types'

export type ZephyrPublishStatus = 'create' | 'update' | 'skip' | 'blocked'
export type ZephyrPublishDiffField =
    | 'name'
    | 'description'
    | 'steps'
    | 'objective'
    | 'preconditions'
    | 'attachments'
    | 'folder'
    | 'labels'
    | 'customFields'
    | 'parameters'

export interface ZephyrPublishDiff {
    field: ZephyrPublishDiffField
    label: string
    local: string
    remote: string
    stepRows?: PreviewStepDiffRow[]
}

export interface ZephyrPublishPreviewItem {
    id: string
    testId: string
    testName: string
    externalId?: string
    projectKey?: string
    folder?: string
    status: ZephyrPublishStatus
    reason: string
    publish: boolean
    diffs: ZephyrPublishDiff[]
    payload: ProviderTest
    attachmentsToUpload: Attachment[]
    attachmentIdsToDelete: string[]
    attachmentWarnings: string[]
}

export interface ZephyrPublishPreview {
    selectionLabel: string
    generatedAt: string
    items: ZephyrPublishPreviewItem[]
    summary: {
        total: number
        create: number
        update: number
        skip: number
        blocked: number
    }
}

export interface ZephyrPublishLogItem {
    testId: string
    testName: string
    status: 'created' | 'updated' | 'skipped' | 'failed' | 'blocked'
    externalId?: string
    reason?: string
    error?: string
    attachmentWarnings?: string[]
}

export interface ZephyrPublishResult {
    created: number
    updated: number
    skipped: number
    failed: number
    blocked: number
    logItems: ZephyrPublishLogItem[]
}
