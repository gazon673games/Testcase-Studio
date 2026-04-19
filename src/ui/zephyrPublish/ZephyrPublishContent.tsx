import * as React from 'react'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem } from '@app/sync'
import {
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewEmptyState,
    PreviewFilterChip,
    PreviewHint,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
} from '../previewDialog'
import { PublishItemCard } from './PublishItemCard'
import type { PublishStatusFilter } from './useZephyrPublishDialogState'

type Translate = (key: string, params?: Record<string, string | number>) => string

type Props = {
    preview: ZephyrPublishPreview | null
    publishMap: Record<string, boolean>
    statusFilter: PublishStatusFilter
    showSkipped: boolean
    selectedOnly: boolean
    loading: boolean
    applying: boolean
    blockedItems: ZephyrPublishPreviewItem[]
    visibleItems: ZephyrPublishPreviewItem[]
    selectedCount: number
    hiddenCount: number
    hiddenSkippedCount: number
    firstBlockedId: string | undefined
    canApply: boolean
    disabledReason: string | null
    onPublishToggle(id: string, value: boolean): void
    onStatusFilterChange(filter: PublishStatusFilter): void
    onShowSkippedChange(value: boolean): void
    onSelectedOnlyChange(value: boolean): void
    onResetFilters(): void
    onApply(): void
    t: Translate
}

export function ZephyrPublishContent({
    preview,
    publishMap,
    statusFilter,
    showSkipped,
    selectedOnly,
    loading,
    applying,
    blockedItems,
    visibleItems,
    selectedCount,
    hiddenCount,
    hiddenSkippedCount,
    firstBlockedId,
    canApply,
    disabledReason,
    onPublishToggle,
    onStatusFilterChange,
    onShowSkippedChange,
    onSelectedOnlyChange,
    onResetFilters,
    onApply,
    t,
}: Props) {
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    React.useEffect(() => {
        itemRefs.current = {}
    }, [preview])

    function scrollToItem(itemId?: string) {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }

    if (!preview) {
        return (
            <div className="preview-dialog__column">
                <PreviewEmptyState title={t('publish.previewEmptyTitle')}>
                    {t('publish.previewEmptyText')}
                </PreviewEmptyState>
            </div>
        )
    }

    return (
        <div className="preview-dialog__column">
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
                            <PreviewButton tone="soft" onClick={() => onStatusFilterChange('blocked')}>
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
                        <PreviewFilterChip active={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')}>
                            {t('publish.filter.all', { count: preview.summary.total })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'create'} onClick={() => onStatusFilterChange('create')}>
                            {t('publish.filter.create', { count: preview.summary.create })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'update'} onClick={() => onStatusFilterChange('update')}>
                            {t('publish.filter.update', { count: preview.summary.update })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'blocked'} onClick={() => onStatusFilterChange('blocked')}>
                            {t('publish.filter.blocked', { count: preview.summary.blocked })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'skip'} onClick={() => onStatusFilterChange('skip')}>
                            {t('publish.filter.skip', { count: preview.summary.skip })}
                        </PreviewFilterChip>
                    </PreviewToolbarGroup>
                    <PreviewToolbarGroup align="end">
                        <label className="preview-dialog__toggle">
                            <input
                                type="checkbox"
                                checked={selectedOnly}
                                onChange={(event) => onSelectedOnlyChange(event.target.checked)}
                            />
                            {t('publish.selectedOnly')}
                        </label>
                        <label className="preview-dialog__toggle">
                            <input
                                type="checkbox"
                                checked={showSkipped}
                                onChange={(event) => onShowSkippedChange(event.target.checked)}
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
                    <PreviewHint>{t('publish.collapsedSkipped', { count: hiddenSkippedCount })}</PreviewHint>
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
                            onToggle={(value) => onPublishToggle(item.id, value)}
                            containerRef={(node) => { itemRefs.current[item.id] = node }}
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
                        onClick={onResetFilters}
                        disabled={loading || applying}
                    >
                        {t('publish.resetFilters')}
                    </PreviewButton>
                    <PreviewButton tone="danger" disabled={!canApply} onClick={onApply}>
                        {applying ? t('publish.running') : t('publish.run')}
                    </PreviewButton>
                </div>
                {disabledReason ? <PreviewHint>{disabledReason}</PreviewHint> : null}
            </PreviewStickyBar>
        </div>
    )
}
