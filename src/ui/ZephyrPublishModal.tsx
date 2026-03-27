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
            setError(err instanceof Error ? err.message : 'Failed to build publish preview')
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
            setError(err instanceof Error ? err.message : 'Failed to publish to Zephyr')
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
    const canApply = !!preview && !loading && !applying && confirmText === 'PUBLISH' && selectedCount > 0

    return (
        <PreviewDialog
            open={open}
            title="Publish Local -> Zephyr"
            subtitle={`Scope: ${selectionLabel}`}
            onClose={onClose}
            initialFocusRef={loadButtonRef}
            canDismiss={!loading && !applying}
        >
            <PreviewDialogSplit
                sidebar={(
                    <div style={columnStyle}>
                        <PreviewCard title="Dry-run">
                            <PreviewHint>
                                This preview compares local tests with current Zephyr state, then prepares a replace publish.
                                A local snapshot is created before the first write, and a publish log is saved after the run.
                            </PreviewHint>
                        </PreviewCard>

                        <PreviewCard title="Confirmation">
                            <PreviewHint>
                                Type <code>PUBLISH</code> to enable the mass replace action.
                            </PreviewHint>
                            <input
                                className="preview-dialog__input"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                placeholder="PUBLISH"
                            />
                        </PreviewCard>

                        {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

                        <div className="preview-dialog__button-row">
                            <PreviewButton
                                ref={loadButtonRef}
                                tone="primary"
                                onClick={handlePreview}
                                disabled={loading || applying}
                            >
                                {loading ? 'Loading preview...' : 'Load dry-run'}
                            </PreviewButton>
                            <PreviewButton tone="ghost" onClick={onClose} disabled={loading || applying}>
                                Close
                            </PreviewButton>
                        </div>
                    </div>
                )}
                content={(
                    <div style={columnStyle}>
                        {!preview ? (
                            <PreviewEmptyState title="Preview">
                                Load the dry-run first to review create, update and blocked items.
                            </PreviewEmptyState>
                        ) : (
                            <>
                                <PreviewCard>
                                    <div className="preview-dialog__summary-row">
                                        <div>
                                            <div className="preview-dialog__card-title">Publish preview</div>
                                            <div className="preview-dialog__subtitle">
                                                {preview.summary.total} tests in scope, {selectedCount} selected to publish
                                            </div>
                                        </div>
                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="ok">{preview.summary.create} create</PreviewBadge>
                                            <PreviewBadge tone="info">{preview.summary.update} update</PreviewBadge>
                                            <PreviewBadge tone="muted">{preview.summary.skip} skip</PreviewBadge>
                                            <PreviewBadge tone="warn">{preview.summary.blocked} blocked</PreviewBadge>
                                        </div>
                                    </div>
                                </PreviewCard>

                                {blockedItems.length > 0 ? (
                                    <PreviewCard title="Blocked items to review first">
                                        <PreviewToolbar>
                                            <PreviewToolbarGroup>
                                                <PreviewHint>
                                                    {blockedItems.length} items cannot be published until their blockers are resolved.
                                                </PreviewHint>
                                            </PreviewToolbarGroup>
                                            <PreviewToolbarGroup align="end">
                                                <PreviewButton
                                                    tone="soft"
                                                    onClick={() => handleStatusFilterChange('blocked')}
                                                >
                                                    Only blocked
                                                </PreviewButton>
                                                <PreviewButton
                                                    tone="ghost"
                                                    onClick={() => scrollToItem(firstBlockedId)}
                                                    disabled={!firstBlockedId}
                                                >
                                                    Jump to first blocked
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
                                                <PreviewHint>+ {blockedItems.length - 4} more blocked items in this preview</PreviewHint>
                                            ) : null}
                                        </div>
                                    </PreviewCard>
                                ) : null}

                                <PreviewCard title="Review filters">
                                    <PreviewToolbar>
                                        <PreviewToolbarGroup>
                                            <PreviewFilterChip
                                                active={statusFilter === 'all'}
                                                onClick={() => handleStatusFilterChange('all')}
                                            >
                                                All {preview.summary.total}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'create'}
                                                onClick={() => handleStatusFilterChange('create')}
                                            >
                                                Create {preview.summary.create}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'update'}
                                                onClick={() => handleStatusFilterChange('update')}
                                            >
                                                Update {preview.summary.update}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'blocked'}
                                                onClick={() => handleStatusFilterChange('blocked')}
                                            >
                                                Blocked {preview.summary.blocked}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'skip'}
                                                onClick={() => handleStatusFilterChange('skip')}
                                            >
                                                Skip {preview.summary.skip}
                                            </PreviewFilterChip>
                                        </PreviewToolbarGroup>
                                        <PreviewToolbarGroup align="end">
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOnly}
                                                    onChange={(event) => setSelectedOnly(event.target.checked)}
                                                />
                                                Selected only
                                            </label>
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={showSkipped}
                                                    onChange={(event) => handleShowSkippedChange(event.target.checked)}
                                                />
                                                Show skipped
                                            </label>
                                            {hiddenCount > 0 ? (
                                                <PreviewBadge tone="muted">{hiddenCount} hidden</PreviewBadge>
                                            ) : null}
                                        </PreviewToolbarGroup>
                                    </PreviewToolbar>
                                </PreviewCard>

                                {hiddenSkippedCount > 0 && !showSkipped && statusFilter !== 'skip' ? (
                                    <PreviewCard className="preview-dialog__collapsed-note">
                                        <PreviewHint>
                                            {hiddenSkippedCount} skipped items are collapsed to keep the publish review focused.
                                        </PreviewHint>
                                    </PreviewCard>
                                ) : null}

                                <div style={listStyle}>
                                    {visibleItems.length === 0 ? (
                                        <PreviewEmptyState title="No items match the current filters">
                                            Adjust the filters to continue reviewing this publish batch.
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
                                        <span>{visibleItems.length} shown</span>
                                        <PreviewBadge tone="info">{selectedCount} selected</PreviewBadge>
                                        {hiddenCount > 0 ? <PreviewBadge tone="muted">{hiddenCount} hidden</PreviewBadge> : null}
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
                                            Reset filters
                                        </PreviewButton>
                                        <PreviewButton tone="danger" disabled={!canApply} onClick={handleApply}>
                                            {applying ? 'Publishing...' : 'Publish to Zephyr'}
                                        </PreviewButton>
                                    </div>
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
                            <span>{item.externalId ?? 'New testcase'}</span>
                            {item.projectKey ? ` / ${item.projectKey}` : ''}
                            {item.folder ? ` / ${item.folder}` : ''}
                        </div>
                    </div>
                    <PreviewBadge tone={tone}>{item.status}</PreviewBadge>
                </div>

                <PreviewHint>{item.reason}</PreviewHint>

                <label style={checkboxLabelStyle}>
                    <input
                        type="checkbox"
                        checked={publish}
                        disabled={item.status === 'blocked' || item.status === 'skip'}
                        onChange={(event) => onToggle(event.target.checked)}
                    />
                    Include in publish run
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
                                leftLabel="Remote"
                                rightLabel="Local publish"
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
    color: '#40506a',
}
