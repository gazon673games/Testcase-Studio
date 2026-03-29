import * as React from 'react'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem, ZephyrPublishResult } from '@core/zephyrPublish'
import {
    PreviewAlert,
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewDiffCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewEmptyState,
    PreviewFilterChip,
    PreviewHint,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
} from './PreviewDialog'
import { useUiPreferences } from './preferences'

type PublishOutcome = ZephyrPublishResult & {
    snapshotPath: string
    logPath: string
}

type Props = {
    open: boolean
    selectionLabel: string
    onClose(): void
    onPreview(): Promise<ZephyrPublishPreview>
    onApply(preview: ZephyrPublishPreview): Promise<PublishOutcome>
}

type PublishStatusFilter = 'all' | ZephyrPublishPreviewItem['status']

export function ZephyrPublishModal({ open, selectionLabel, onClose, onPreview, onApply }: Props) {
    const { t } = useUiPreferences()
    const loadButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrPublishPreview | null>(null)
    const [publishMap, setPublishMap] = React.useState<Record<string, boolean>>({})
    const [confirmText, setConfirmText] = React.useState('')
    const [statusFilter, setStatusFilter] = React.useState<PublishStatusFilter>('all')
    const [showSkipped, setShowSkipped] = React.useState(false)
    const [selectedOnly, setSelectedOnly] = React.useState(false)

    React.useEffect(() => {
        if (!open) return
        itemRefs.current = {}
        setError(null)
        setPreview(null)
        setPublishMap({})
        setConfirmText('')
        setStatusFilter('all')
        setShowSkipped(false)
        setSelectedOnly(false)
    }, [open, selectionLabel])

    React.useEffect(() => {
        if (!open || preview || loading || applying) return
        void handlePreview()
    }, [open, preview, loading, applying])

    async function handlePreview() {
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview()
            itemRefs.current = {}
            setPreview(nextPreview)
            setPublishMap(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.publish])))
            setStatusFilter('all')
            setShowSkipped(false)
            setSelectedOnly(false)
        } catch (err) {
            setPreview(null)
            setPublishMap({})
            setError(err instanceof Error ? err.message : t('publish.previewError'))
        } finally {
            setLoading(false)
        }
    }

    async function handleApply() {
        if (!preview) return
        setApplying(true)
        setError(null)
        try {
            await onApply({
                ...preview,
                items: preview.items.map((item) => ({
                    ...item,
                    publish: publishMap[item.id] ?? item.publish,
                })),
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('publish.applyError'))
        } finally {
            setApplying(false)
        }
    }

    function handleStatusFilterChange(nextFilter: PublishStatusFilter) {
        if (nextFilter === 'skip') setShowSkipped(true)
        setStatusFilter(nextFilter)
    }

    function handleShowSkippedChange(checked: boolean) {
        setShowSkipped(checked)
        if (!checked && statusFilter === 'skip') {
            setStatusFilter('all')
        }
    }

    function scrollToItem(itemId?: string) {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }

    const items = preview?.items ?? []
    const blockedItems = React.useMemo(
        () => items.filter((item) => item.status === 'blocked'),
        [items]
    )
    const visibleItems = React.useMemo(
        () =>
            items.filter((item) => {
                if (statusFilter !== 'all' && item.status !== statusFilter) return false
                if (!showSkipped && statusFilter !== 'skip' && item.status === 'skip') return false
                if (selectedOnly && !(publishMap[item.id] ?? item.publish)) return false
                return true
            }),
        [items, publishMap, selectedOnly, showSkipped, statusFilter]
    )
    const selectedCount = items.filter((item) => publishMap[item.id] ?? item.publish).length
    const hiddenCount = items.length - visibleItems.length
    const hiddenSkippedCount = items.filter(
        (item) => item.status === 'skip' && (statusFilter !== 'skip' || !showSkipped)
    ).length
    const firstBlockedId = blockedItems[0]?.id
    const confirmReady = confirmText.trim().toUpperCase() === 'PUBLISH'
    const requiresConfirmation = selectedCount > 1
    const canApply = !!preview && !loading && !applying && selectedCount > 0 && (!requiresConfirmation || confirmReady)
    const disabledReason = !preview
        ? t('publish.previewLoadingHint')
        : selectedCount === 0
            ? t('publish.noSelected')
            : requiresConfirmation && !confirmReady
                ? t('publish.confirmationMissing')
                : null

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
                sidebar={(
                    <div style={columnStyle}>
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
                    <div style={columnStyle}>
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

                                <div style={listStyle}>
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
                sidebarWidth={320}
            />
        </PreviewDialog>
    )
}

function PublishItemCard({
    item,
    publish,
    onToggle,
    containerRef,
}: {
    item: ZephyrPublishPreviewItem
    publish: boolean
    onToggle(value: boolean): void
    containerRef?: (node: HTMLDivElement | null) => void
}) {
    const { t } = useUiPreferences()
    const tone =
        item.status === 'create'
            ? 'ok'
            : item.status === 'update'
                ? 'info'
                : item.status === 'blocked'
                    ? 'warn'
                    : 'muted'

    return (
        <div ref={containerRef} tabIndex={-1}>
            <PreviewCard>
                <div className="preview-dialog__summary-row">
                    <div style={{ minWidth: 0 }}>
                        <div className="preview-dialog__card-title">{item.testName}</div>
                        <div className="preview-dialog__subtitle">
                            <span>{item.externalId ?? t('publish.newCase')}</span>
                            {item.projectKey ? ` / ${item.projectKey}` : ''}
                            {item.folder ? ` / ${item.folder}` : ''}
                        </div>
                    </div>
                    <PreviewBadge tone={tone}>{t(`publish.status.${item.status}`)}</PreviewBadge>
                </div>

                <PreviewHint>{item.reason}</PreviewHint>

                <label style={checkboxLabelStyle}>
                    <input
                        type="checkbox"
                        checked={publish}
                        disabled={item.status === 'blocked' || item.status === 'skip'}
                        onChange={(event) => onToggle(event.target.checked)}
                    />
                    {t('publish.include')}
                </label>

                {item.attachmentWarnings.length > 0 ? (
                    <PreviewAlert tone="warning">
                        {item.attachmentWarnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                        ))}
                    </PreviewAlert>
                ) : null}

                {item.diffs.length > 0 ? (
                    <div style={listStyle}>
                        {item.diffs.map((diff) => (
                            <PreviewDiffCard
                                key={`${item.id}:${diff.field}`}
                                title={diff.label}
                                leftLabel={t('preview.remote')}
                                rightLabel={t('preview.localPublish')}
                                leftText={diff.remote}
                                rightText={diff.local}
                                stepRows={diff.stepRows}
                                leftSide="remote"
                                rightSide="local"
                            />
                        ))}
                    </div>
                ) : null}
            </PreviewCard>
        </div>
    )
}

const columnStyle: React.CSSProperties = {
    display: 'grid',
    alignContent: 'start',
    gap: 14,
}

const listStyle: React.CSSProperties = {
    display: 'grid',
    gap: 12,
}

const checkboxLabelStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
}
