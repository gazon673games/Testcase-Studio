import * as React from 'react'
import type {
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportStrategy,
} from '@app/sync'
import {
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewEmptyState,
    PreviewHint,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
    PreviewFilterChip,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { ZephyrImportPreviewItemCard } from './ZephyrImportPreviewItemCard'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

type Props = {
    preview: ZephyrImportPreview | null
    items: ZephyrImportPreviewItem[]
    visibleItems: ZephyrImportPreviewItem[]
    conflictItems: ZephyrImportPreviewItem[]
    strategies: Record<string, ZephyrImportStrategy>
    statusFilter: ImportStatusFilter
    showUnchanged: boolean
    hiddenCount: number
    hiddenUnchangedCount: number
    replaceCount: number
    firstConflictId?: string
    loading: boolean
    applying: boolean
    itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    strategySummary: Record<ZephyrImportStrategy, number>
    onApply(): void | Promise<void>
    onResetFilters(): void
    onChangeStrategy(itemId: string, value: ZephyrImportStrategy): void
    onStatusFilterChange(value: ImportStatusFilter): void
    onShowUnchangedChange(value: boolean): void
    onJumpToItem(itemId?: string): void
}

export function ZephyrImportPreviewPane({
    preview,
    items,
    visibleItems,
    conflictItems,
    strategies,
    statusFilter,
    showUnchanged,
    hiddenCount,
    hiddenUnchangedCount,
    replaceCount,
    firstConflictId,
    loading,
    applying,
    itemRefs,
    strategySummary,
    onApply,
    onResetFilters,
    onChangeStrategy,
    onStatusFilterChange,
    onShowUnchangedChange,
    onJumpToItem,
}: Props) {
    const { t } = useUiPreferences()

    if (!preview) {
        return (
            <div className="preview-dialog__column">
                <PreviewEmptyState title={t('import.previewEmptyTitle')}>
                    {t('import.previewEmptyText')}
                </PreviewEmptyState>
            </div>
        )
    }

    return (
        <div className="preview-dialog__column">
            <PreviewCard>
                <div className="preview-dialog__summary-row">
                    <div>
                        <div className="preview-dialog__card-title">{t('import.previewTitle')}</div>
                        <div className="preview-dialog__subtitle">
                            {t('import.query')}: <code>{preview.query || t('import.directLookup')}</code>
                        </div>
                    </div>
                    <div className="preview-dialog__badge-row">
                        <PreviewBadge tone="neutral">{t('import.total', { count: preview.summary.total })}</PreviewBadge>
                        <PreviewBadge tone="ok">{t('import.new', { count: preview.summary.created })}</PreviewBadge>
                        <PreviewBadge tone="info">{t('import.updates', { count: preview.summary.updates })}</PreviewBadge>
                        <PreviewBadge tone="warn">{t('import.conflicts', { count: preview.summary.conflicts })}</PreviewBadge>
                        <PreviewBadge tone="muted">{t('import.unchanged', { count: preview.summary.unchanged })}</PreviewBadge>
                    </div>
                </div>
            </PreviewCard>

            {conflictItems.length > 0 ? (
                <PreviewCard title={t('import.conflictsTitle')}>
                    <PreviewToolbar>
                        <PreviewToolbarGroup>
                            <PreviewHint>{t('import.conflictsHint')}</PreviewHint>
                        </PreviewToolbarGroup>
                        <PreviewToolbarGroup align="end">
                            <PreviewButton tone="soft" onClick={() => onStatusFilterChange('conflict')}>
                                {t('import.onlyConflicts')}
                            </PreviewButton>
                            <PreviewButton
                                tone="ghost"
                                onClick={() => onJumpToItem(firstConflictId)}
                                disabled={!firstConflictId}
                            >
                                {t('import.jumpFirstConflict')}
                            </PreviewButton>
                        </PreviewToolbarGroup>
                    </PreviewToolbar>

                    <div className="preview-dialog__badge-row">
                        <PreviewBadge tone="info">{t('import.replaceCount', { count: strategySummary.replace })}</PreviewBadge>
                        <PreviewBadge tone="muted">{t('import.skipCount', { count: strategySummary.skip })}</PreviewBadge>
                        <PreviewBadge tone="warn">
                            {t('import.mergeLaterCount', { count: strategySummary['merge-locally-later'] })}
                        </PreviewBadge>
                    </div>

                    <div className="preview-dialog__quick-list">
                        {conflictItems.slice(0, 4).map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className="preview-dialog__quick-link"
                                onClick={() => onJumpToItem(item.id)}
                            >
                                {item.remoteName}
                            </button>
                        ))}
                        {conflictItems.length > 4 ? (
                            <PreviewHint>{t('import.moreConflicts', { count: conflictItems.length - 4 })}</PreviewHint>
                        ) : null}
                    </div>
                </PreviewCard>
            ) : null}

            <PreviewCard title={t('import.reviewFilters')}>
                <PreviewToolbar>
                    <PreviewToolbarGroup>
                        <PreviewFilterChip active={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')}>
                            {t('import.filter.all', { count: preview.summary.total })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'new'} onClick={() => onStatusFilterChange('new')}>
                            {t('import.filter.new', { count: preview.summary.created })}
                        </PreviewFilterChip>
                        <PreviewFilterChip active={statusFilter === 'update'} onClick={() => onStatusFilterChange('update')}>
                            {t('import.filter.updates', { count: preview.summary.updates })}
                        </PreviewFilterChip>
                        <PreviewFilterChip
                            active={statusFilter === 'conflict'}
                            onClick={() => onStatusFilterChange('conflict')}
                        >
                            {t('import.filter.conflicts', { count: preview.summary.conflicts })}
                        </PreviewFilterChip>
                        <PreviewFilterChip
                            active={statusFilter === 'unchanged'}
                            onClick={() => onStatusFilterChange('unchanged')}
                        >
                            {t('import.filter.unchanged', { count: preview.summary.unchanged })}
                        </PreviewFilterChip>
                    </PreviewToolbarGroup>
                    <PreviewToolbarGroup align="end">
                        <label className="preview-dialog__toggle">
                            <input
                                type="checkbox"
                                checked={showUnchanged}
                                onChange={(event) => onShowUnchangedChange(event.target.checked)}
                            />
                            {t('import.showUnchanged')}
                        </label>
                        {hiddenCount > 0 ? (
                            <PreviewBadge tone="muted">{t('import.hidden', { count: hiddenCount })}</PreviewBadge>
                        ) : null}
                    </PreviewToolbarGroup>
                </PreviewToolbar>
            </PreviewCard>

            {hiddenUnchangedCount > 0 && !showUnchanged && statusFilter !== 'unchanged' ? (
                <PreviewCard className="preview-dialog__collapsed-note">
                    <PreviewHint>{t('import.collapsedUnchanged', { count: hiddenUnchangedCount })}</PreviewHint>
                </PreviewCard>
            ) : null}

            <div className="preview-dialog__list">
                {items.length === 0 ? (
                    <PreviewEmptyState title={t('import.emptyFound')}>
                        {t('import.emptyFoundText')}
                    </PreviewEmptyState>
                ) : visibleItems.length === 0 ? (
                    <PreviewEmptyState title={t('import.emptyFilters')}>
                        {t('import.emptyFiltersText')}
                    </PreviewEmptyState>
                ) : (
                    visibleItems.map((item) => (
                        <ZephyrImportPreviewItemCard
                            key={item.id}
                            item={item}
                            strategy={strategies[item.id] ?? item.strategy}
                            onChangeStrategy={(value) => onChangeStrategy(item.id, value)}
                            containerRef={(node) => {
                                itemRefs.current[item.id] = node
                            }}
                        />
                    ))
                )}
            </div>

            <PreviewStickyBar>
                <div className="preview-dialog__sticky-summary">
                    <span>{t('import.shown', { count: visibleItems.length })}</span>
                    <PreviewBadge tone="info">{t('import.replaceCount', { count: replaceCount })}</PreviewBadge>
                    {hiddenCount > 0 ? (
                        <PreviewBadge tone="muted">{t('import.hidden', { count: hiddenCount })}</PreviewBadge>
                    ) : null}
                </div>
                <div className="preview-dialog__button-row">
                    <PreviewButton tone="ghost" onClick={onResetFilters} disabled={applying || loading}>
                        {t('import.resetFilters')}
                    </PreviewButton>
                    <PreviewButton
                        tone="primary"
                        disabled={applying || loading || items.length === 0}
                        onClick={onApply}
                    >
                        {applying ? t('import.applying') : t('import.apply')}
                    </PreviewButton>
                </div>
            </PreviewStickyBar>
        </div>
    )
}
