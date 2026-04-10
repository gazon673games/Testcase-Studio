import * as React from 'react'
import type { ZephyrPublishPreview } from '@app/sync'
import {
    PreviewAlert,
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewEmptyState,
    PreviewFilterChip,
    PreviewHint,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { PublishItemCard } from './PublishItemCard'
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
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const {
        loading,
        applying,
        error,
        preview,
        publishMap,
        confirmText,
        statusFilter,
        showSkipped,
        selectedOnly,
        blockedItems,
        visibleItems,
        selectedCount,
        hiddenCount,
        hiddenSkippedCount,
        firstBlockedId,
        confirmReady,
        requiresConfirmation,
        canApply,
        disabledReason,
        setPublishMap,
        setConfirmText,
        setStatusFilter,
        setShowSkipped,
        setSelectedOnly,
        handlePreview,
        handleApply,
        handleStatusFilterChange,
        handleShowSkippedChange,
    } = useZephyrPublishDialogState({
        open,
        selectionLabel,
        onClose,
        onPreview: async () => {
            itemRefs.current = {}
            return onPreview()
        },
        onApply,
        t,
    })

    React.useEffect(() => {
        if (!open) return
        itemRefs.current = {}
    }, [open, selectionLabel])

    function scrollToItem(itemId?: string) {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }

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
            <PreviewDialogSplit
                className="preview-dialog__split--compact"
                sidebar={(
                    <div className="preview-dialog__column">
                        <PreviewCard title={t('publish.dryRun')}>
                            <PreviewHint>{t('publish.dryRunHint')}</PreviewHint>
                        </PreviewCard>

                        <PreviewCard title={t('publish.confirmation')}>
                            <PreviewHint>
                                {requiresConfirmation ? t('publish.confirmationHint') : t('publish.confirmationReady')}
                            </PreviewHint>
                            <input
                                className="preview-dialog__input"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                placeholder="PUBLISH"
                                disabled={!requiresConfirmation}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && canApply) {
                                        event.preventDefault()
                                        void handleApply()
                                    }
                                }}
                            />
                            {preview ? (
                                <PreviewHint>
                                    {requiresConfirmation
                                        ? (confirmReady ? t('publish.confirmationReady') : disabledReason ?? t('publish.confirmationMissing'))
                                        : t('publish.confirmationReady')}
                                </PreviewHint>
                            ) : null}
                        </PreviewCard>

                        {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

                        <div className="preview-dialog__button-row">
                            <PreviewButton
                                ref={loadButtonRef}
                                tone="soft"
                                onClick={handlePreview}
                                disabled={loading || applying}
                            >
                                {loading ? t('publish.loadingPreview') : preview ? t('publish.refreshPreview') : t('publish.preparePreview')}
                            </PreviewButton>
                            <PreviewButton tone="danger" disabled={!canApply} onClick={handleApply}>
                                {applying ? t('publish.running') : t('publish.run')}
                            </PreviewButton>
                            <PreviewButton tone="ghost" onClick={onClose} disabled={loading || applying}>
                                {t('publish.close')}
                            </PreviewButton>
                        </div>
                        {disabledReason ? <PreviewHint>{disabledReason}</PreviewHint> : null}
                    </div>
                )}
                content={(
                    <div className="preview-dialog__column">
                        {!preview ? (
                            <PreviewEmptyState title={t('publish.previewEmptyTitle')}>
                                {t('publish.previewEmptyText')}
                            </PreviewEmptyState>
                        ) : (
                            <>
                                <PreviewCard>
                                    <div className="preview-dialog__summary-row">
                                        <div>
                                            <div className="preview-dialog__card-title">{t('publish.previewTitle')}</div>
                                            <div className="preview-dialog__subtitle">
                                                {t('publish.scopeSummary', { total: preview.summary.total, selected: selectedCount })}
                                            </div>
                                        </div>
                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="ok">{t('publish.create', { count: preview.summary.create })}</PreviewBadge>
                                            <PreviewBadge tone="info">{t('publish.update', { count: preview.summary.update })}</PreviewBadge>
                                            <PreviewBadge tone="muted">{t('publish.skip', { count: preview.summary.skip })}</PreviewBadge>
                                            <PreviewBadge tone="warn">{t('publish.blocked', { count: preview.summary.blocked })}</PreviewBadge>
                                        </div>
                                    </div>
                                </PreviewCard>

                                {blockedItems.length > 0 ? (
                                    <PreviewCard title={t('publish.blockedTitle')}>
                                        <PreviewToolbar>
                                            <PreviewToolbarGroup>
                                                <PreviewHint>{t('publish.blockedHint')}</PreviewHint>
                                            </PreviewToolbarGroup>
                                            <PreviewToolbarGroup align="end">
                                                <PreviewButton
                                                    tone="soft"
                                                    onClick={() => handleStatusFilterChange('blocked')}
                                                >
                                                    {t('publish.onlyBlocked')}
                                                </PreviewButton>
                                                <PreviewButton
                                                    tone="ghost"
                                                    onClick={() => scrollToItem(firstBlockedId)}
                                                    disabled={!firstBlockedId}
                                                >
                                                    {t('publish.jumpFirstBlocked')}
                                                </PreviewButton>
                                            </PreviewToolbarGroup>
                                        </PreviewToolbar>

                                        <div className="preview-dialog__quick-list">
                                            {blockedItems.slice(0, 4).map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="preview-dialog__quick-link"
                                                    onClick={() => scrollToItem(item.id)}
                                                >
                                                    {item.testName}
                                                </button>
                                            ))}
                                            {blockedItems.length > 4 ? (
                                                <PreviewHint>{t('publish.moreBlocked', { count: blockedItems.length - 4 })}</PreviewHint>
                                            ) : null}
                                        </div>
                                    </PreviewCard>
                                ) : null}

                                <PreviewCard title={t('publish.reviewFilters')}>
                                    <PreviewToolbar>
                                        <PreviewToolbarGroup>
                                            <PreviewFilterChip
                                                active={statusFilter === 'all'}
                                                onClick={() => handleStatusFilterChange('all')}
                                            >
                                                {t('publish.filter.all', { count: preview.summary.total })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'create'}
                                                onClick={() => handleStatusFilterChange('create')}
                                            >
                                                {t('publish.filter.create', { count: preview.summary.create })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'update'}
                                                onClick={() => handleStatusFilterChange('update')}
                                            >
                                                {t('publish.filter.update', { count: preview.summary.update })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'blocked'}
                                                onClick={() => handleStatusFilterChange('blocked')}
                                            >
                                                {t('publish.filter.blocked', { count: preview.summary.blocked })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'skip'}
                                                onClick={() => handleStatusFilterChange('skip')}
                                            >
                                                {t('publish.filter.skip', { count: preview.summary.skip })}
                                            </PreviewFilterChip>
                                        </PreviewToolbarGroup>
                                        <PreviewToolbarGroup align="end">
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOnly}
                                                    onChange={(event) => setSelectedOnly(event.target.checked)}
                                                />
                                                {t('publish.selectedOnly')}
                                            </label>
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={showSkipped}
                                                    onChange={(event) => handleShowSkippedChange(event.target.checked)}
                                                />
                                                {t('publish.showSkipped')}
                                            </label>
                                            {hiddenCount > 0 ? (
                                                <PreviewBadge tone="muted">{t('publish.hidden', { count: hiddenCount })}</PreviewBadge>
                                            ) : null}
                                        </PreviewToolbarGroup>
                                    </PreviewToolbar>
                                </PreviewCard>

                                {hiddenSkippedCount > 0 && !showSkipped && statusFilter !== 'skip' ? (
                                    <PreviewCard className="preview-dialog__collapsed-note">
                                        <PreviewHint>
                                            {t('publish.collapsedSkipped', { count: hiddenSkippedCount })}
                                        </PreviewHint>
                                    </PreviewCard>
                                ) : null}

                                <div className="preview-dialog__list">
                                    {visibleItems.length === 0 ? (
                                        <PreviewEmptyState title={t('publish.emptyFilters')}>
                                            {t('publish.emptyFiltersText')}
                                        </PreviewEmptyState>
                                    ) : (
                                        visibleItems.map((item) => (
                                            <PublishItemCard
                                                key={item.id}
                                                item={item}
                                                publish={publishMap[item.id] ?? item.publish}
                                                onToggle={(value) => setPublishMap((current) => ({ ...current, [item.id]: value }))}
                                                containerRef={(node) => {
                                                    itemRefs.current[item.id] = node
                                                }}
                                            />
                                        ))
                                    )}
                                </div>

                                <PreviewStickyBar>
                                    <div className="preview-dialog__sticky-summary">
                                        <span>{t('publish.shown', { count: visibleItems.length })}</span>
                                        <PreviewBadge tone="info">{t('publish.selected', { count: selectedCount })}</PreviewBadge>
                                        {hiddenCount > 0 ? <PreviewBadge tone="muted">{t('publish.hidden', { count: hiddenCount })}</PreviewBadge> : null}
                                    </div>
                                    <div className="preview-dialog__button-row">
                                        <PreviewButton
                                            tone="ghost"
                                            onClick={() => {
                                                setStatusFilter('all')
                                                setShowSkipped(false)
                                                setSelectedOnly(false)
                                            }}
                                            disabled={loading || applying}
                                        >
                                            {t('publish.resetFilters')}
                                        </PreviewButton>
                                        <PreviewButton tone="danger" disabled={!canApply} onClick={handleApply}>
                                            {applying ? t('publish.running') : t('publish.run')}
                                        </PreviewButton>
                                    </div>
                                    {disabledReason ? (
                                        <PreviewHint>{disabledReason}</PreviewHint>
                                    ) : null}
                                </PreviewStickyBar>
                            </>
                        )}
                    </div>
                )}
            />
        </PreviewDialog>
    )
}
