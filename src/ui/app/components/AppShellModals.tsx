import * as React from 'react'
import type { IncludedCaseCandidate, IncludedCaseResolution } from '@app/workspace'
import type { ZephyrImportApplyResult, ZephyrImportPreview, ZephyrImportRequest, ZephyrPublishPreview } from '@app/sync'
import { SettingsModal } from '../../settings'
import { ZephyrImportModal } from '../../zephyrImport/ZephyrImportModal'
import { ZephyrPublishModal } from '../../zephyrPublish'
import { ZephyrCreateFromScratchModal } from '../../zephyrPublish/ZephyrCreateFromScratchModal'
import { IncludedCaseResolutionModal } from '../../includedCases/IncludedCaseResolutionModal'
import { AppUpdateModal } from './AppUpdateModal'
import type { AppUpdateCheckResult } from '@shared/appUpdates'
import type { PublishOutcome } from '../../zephyrPublish/useZephyrPublishDialogState'

type Props = {
    settingsOpen: boolean
    importOpen: boolean
    publishOpen: boolean
    createFromScratchPreview: ZephyrPublishPreview | null
    includedCasesOpen: boolean
    includedCasesItems: IncludedCaseCandidate[]
    importDestinationLabel: string
    publishSelectionLabel: string
    startupUpdate: AppUpdateCheckResult | null
    onCloseSettings(): void
    onCloseImport(): void
    onClosePublish(): void
    onCloseCreateFromScratch(): void
    onCloseIncludedCases(): void
    onDismissStartupUpdate(): void
    onPreviewImport(request: ZephyrImportRequest): Promise<ZephyrImportPreview>
    onApplyImport: (preview: ZephyrImportPreview) => Promise<ZephyrImportApplyResult>
    onPreviewPublish: () => Promise<ZephyrPublishPreview>
    onApplyPublish: (preview: ZephyrPublishPreview) => Promise<PublishOutcome>
    onApplyCreateFromScratch: (preview: ZephyrPublishPreview) => Promise<PublishOutcome>
    onApplyIncludedCases(decisions: Record<string, IncludedCaseResolution>): void
}

export function AppShellModals(props: Props) {
    return (
        <>
            <SettingsModal open={props.settingsOpen} onClose={props.onCloseSettings} />
            <ZephyrImportModal
                open={props.importOpen}
                destinationLabel={props.importDestinationLabel}
                onClose={props.onCloseImport}
                onPreview={props.onPreviewImport}
                onApply={props.onApplyImport}
            />
            <ZephyrPublishModal
                open={props.publishOpen}
                selectionLabel={props.publishSelectionLabel}
                onClose={props.onClosePublish}
                onPreview={props.onPreviewPublish}
                onApply={props.onApplyPublish}
            />
            <ZephyrCreateFromScratchModal
                open={!!props.createFromScratchPreview}
                preview={props.createFromScratchPreview}
                onClose={props.onCloseCreateFromScratch}
                onCreate={props.onApplyCreateFromScratch}
            />
            <IncludedCaseResolutionModal
                open={props.includedCasesOpen}
                items={props.includedCasesItems}
                onClose={props.onCloseIncludedCases}
                onApply={props.onApplyIncludedCases}
            />
            <AppUpdateModal update={props.startupUpdate} onClose={props.onDismissStartupUpdate} />
        </>
    )
}
