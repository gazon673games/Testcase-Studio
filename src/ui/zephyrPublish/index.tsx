import * as React from 'react'
import type { ZephyrPublishPreview } from '@app/sync'
import { PreviewDialog } from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { ZephyrPublishContent } from './ZephyrPublishContent'
import { ZephyrPublishSidebar } from './ZephyrPublishSidebar'
import { type PublishOutcome, useZephyrPublishDialogState } from './useZephyrPublishDialogState'

type Props = {
    open: boolean
    selectionLabel: string
    onClose(): void
    onPreview(): Promise<ZephyrPublishPreview>
    onApply(preview: ZephyrPublishPreview): Promise<PublishOutcome>
}

export function ZephyrPublishModal({ open, selectionLabel, onClose, onPreview, onApply }: Props) {
    const { t } = useUiPreferences()
    const loadButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const {
        loading, applying, error, preview,
        publishMap, confirmText, statusFilter, showSkipped, selectedOnly,
        blockedItems, visibleItems, selectedCount, hiddenCount, hiddenSkippedCount,
        firstBlockedId, confirmReady, requiresConfirmation, canApply, disabledReason,
        setPublishMap, setConfirmText, setStatusFilter, setShowSkipped, setSelectedOnly,
        handlePreview, handleApply, handleStatusFilterChange, handleShowSkippedChange,
    } = useZephyrPublishDialogState({ open, selectionLabel, onClose, onPreview, onApply, t })

    return (
        <PreviewDialog
            open={open}
            title={t('publish.title')}
            subtitle={(
                <span className="preview-dialog__scope-chip">
                    <span className="preview-dialog__scope-chip-label">{t('publish.scopeLabel')}</span>
                    <span className="preview-dialog__scope-chip-value">{selectionLabel}</span>
                </span>
            )}
            onClose={onClose}
            initialFocusRef={loadButtonRef}
            canDismiss={!loading && !applying}
        >
            <div className="preview-dialog__split preview-dialog__split--compact">
                <div className="preview-dialog__sidebar">
                    <ZephyrPublishSidebar
                        loading={loading}
                        applying={applying}
                        error={error}
                        preview={preview}
                        confirmText={confirmText}
                        confirmReady={confirmReady}
                        requiresConfirmation={requiresConfirmation}
                        canApply={canApply}
                        disabledReason={disabledReason}
                        loadButtonRef={loadButtonRef}
                        onConfirmTextChange={setConfirmText}
                        onPreview={handlePreview}
                        onApply={handleApply}
                        onClose={onClose}
                        t={t}
                    />
                </div>
                <div className="preview-dialog__content">
                    <ZephyrPublishContent
                        preview={preview}
                        publishMap={publishMap}
                        statusFilter={statusFilter}
                        showSkipped={showSkipped}
                        selectedOnly={selectedOnly}
                        loading={loading}
                        applying={applying}
                        blockedItems={blockedItems}
                        visibleItems={visibleItems}
                        selectedCount={selectedCount}
                        hiddenCount={hiddenCount}
                        hiddenSkippedCount={hiddenSkippedCount}
                        firstBlockedId={firstBlockedId}
                        canApply={canApply}
                        disabledReason={disabledReason}
                        onPublishToggle={(id, value) => setPublishMap((current) => ({ ...current, [id]: value }))}
                        onStatusFilterChange={handleStatusFilterChange}
                        onShowSkippedChange={handleShowSkippedChange}
                        onSelectedOnlyChange={setSelectedOnly}
                        onResetFilters={() => { setStatusFilter('all'); setShowSkipped(false); setSelectedOnly(false) }}
                        onApply={handleApply}
                        t={t}
                    />
                </div>
            </div>
        </PreviewDialog>
    )
}
