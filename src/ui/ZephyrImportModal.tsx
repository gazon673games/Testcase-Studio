import * as React from 'react'
import type {
    ZephyrImportApplyResult,
    ZephyrImportMode,
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@core/zephyrImport'
import {
    PreviewAlert,
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewDiffCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewEmptyState,
    PreviewField,
    PreviewFilterChip,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
} from './PreviewDialog'

type Props = {
    open: boolean
    destinationLabel: string
    onClose(): void
    onPreview(request: Omit<ZephyrImportRequest, 'destinationFolderId'>): Promise<ZephyrImportPreview>
    onApply(preview: ZephyrImportPreview): Promise<ZephyrImportApplyResult>
}

type ImportStatusFilter = 'all' | ZephyrImportPreviewItem['status']

const MODE_LABELS: Record<ZephyrImportMode, string> = {
    project: 'Project',
    folder: 'Folder',
    keys: 'Key set',
}

export function ZephyrImportModal({ open, destinationLabel, onClose, onPreview, onApply }: Props) {
    const projectInputRef = React.useRef<HTMLInputElement | null>(null)
    const folderInputRef = React.useRef<HTMLInputElement | null>(null)
    const refsInputRef = React.useRef<HTMLTextAreaElement | null>(null)
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const [mode, setMode] = React.useState<ZephyrImportMode>('project')
    const [projectKey, setProjectKey] = React.useState('')
    const [folder, setFolder] = React.useState('')
    const [refsText, setRefsText] = React.useState('')
    const [rawQuery, setRawQuery] = React.useState('')
    const [maxResults, setMaxResults] = React.useState('100')
    const [mirrorRemoteFolders, setMirrorRemoteFolders] = React.useState(true)
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrImportPreview | null>(null)
    const [strategies, setStrategies] = React.useState<Record<string, ZephyrImportStrategy>>({})
    const [statusFilter, setStatusFilter] = React.useState<ImportStatusFilter>('all')
    const [showUnchanged, setShowUnchanged] = React.useState(false)

    React.useEffect(() => {
        if (!open) return
        itemRefs.current = {}
        setError(null)
        setPreview(null)
        setStrategies({})
        setStatusFilter('all')
        setShowUnchanged(false)
    }, [open, destinationLabel])

    const refs = React.useMemo(
        () =>
            refsText
                .split(/[\s,;]+/g)
                .map((item) => item.trim())
                .filter(Boolean),
        [refsText]
    )

    const request = React.useMemo<Omit<ZephyrImportRequest, 'destinationFolderId'>>(
        () => ({
            mode,
            projectKey,
            folder,
            refs,
            rawQuery,
            maxResults: Math.max(1, Number(maxResults) || 100),
            mirrorRemoteFolders,
        }),
        [folder, maxResults, mirrorRemoteFolders, mode, projectKey, rawQuery, refs]
    )

    const items = preview?.items ?? []
    const conflictItems = React.useMemo(
        () => items.filter((item) => item.status === 'conflict'),
        [items]
    )
    const replaceCount = React.useMemo(
        () =>
            items.filter((item) => {
                if (item.status === 'unchanged') return false
                return (strategies[item.id] ?? item.strategy) === 'replace'
            }).length,
        [items, strategies]
    )
    const strategySummary = React.useMemo(() => {
        const counts: Record<ZephyrImportStrategy, number> = {
            replace: 0,
            skip: 0,
            'merge-locally-later': 0,
        }
        for (const item of conflictItems) {
            const strategy = strategies[item.id] ?? item.strategy
            counts[strategy] += 1
        }
        return counts
    }, [conflictItems, strategies])
    const visibleItems = React.useMemo(
        () =>
            items.filter((item) => {
                if (statusFilter !== 'all' && item.status !== statusFilter) return false
                if (!showUnchanged && statusFilter !== 'unchanged' && item.status === 'unchanged') return false
                return true
            }),
        [items, showUnchanged, statusFilter]
    )
    const hiddenCount = items.length - visibleItems.length
    const hiddenUnchangedCount = items.filter(
        (item) => item.status === 'unchanged' && (statusFilter !== 'unchanged' || !showUnchanged)
    ).length
    const firstConflictId = conflictItems[0]?.id

    async function handlePreview(event?: React.FormEvent) {
        event?.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview(request)
            itemRefs.current = {}
            setPreview(nextPreview)
            setStrategies(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.strategy])))
            setStatusFilter('all')
            setShowUnchanged(false)
        } catch (err) {
            setPreview(null)
            setStrategies({})
            setError(err instanceof Error ? err.message : 'Failed to load import preview')
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
                    strategy: strategies[item.id] ?? item.strategy,
                })),
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply import')
        } finally {
            setApplying(false)
        }
    }

    function handleStatusFilterChange(nextFilter: ImportStatusFilter) {
        if (nextFilter === 'unchanged') setShowUnchanged(true)
        setStatusFilter(nextFilter)
    }

    function handleShowUnchangedChange(checked: boolean) {
        setShowUnchanged(checked)
        if (!checked && statusFilter === 'unchanged') {
            setStatusFilter('all')
        }
    }

    function scrollToItem(itemId?: string) {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }

    const canPreview =
        !loading &&
        !applying &&
        ((mode === 'project' && projectKey.trim().length > 0) ||
            (mode === 'folder' && folder.trim().length > 0) ||
            (mode === 'keys' && refs.length > 0))
    const initialFocusRef =
        mode === 'keys'
            ? refsInputRef
            : mode === 'folder'
                ? folderInputRef
                : projectInputRef

    return (
        <PreviewDialog
            open={open}
            title="Import From Zephyr"
            subtitle={`Destination: ${destinationLabel}`}
            onClose={onClose}
            initialFocusRef={initialFocusRef}
            canDismiss={!loading && !applying}
        >
            <PreviewDialogSplit
                sidebar={(
                    <form style={columnStyle} onSubmit={handlePreview}>
                        <PreviewCard title="Scope">
                            <div style={tabRowStyle}>
                                {(Object.keys(MODE_LABELS) as ZephyrImportMode[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        style={value === mode ? { ...tabButtonStyle, ...tabButtonActiveStyle } : tabButtonStyle}
                                        onClick={() => setMode(value)}
                                    >
                                        {MODE_LABELS[value]}
                                    </button>
                                ))}
                            </div>

                            {mode !== 'keys' && (
                                <PreviewField label="Project key">
                                    <input
                                        ref={projectInputRef}
                                        className="preview-dialog__input"
                                        value={projectKey}
                                        onChange={(event) => setProjectKey(event.target.value)}
                                        placeholder="PROD"
                                    />
                                </PreviewField>
                            )}

                            {mode === 'folder' && (
                                <PreviewField label="Folder path">
                                    <input
                                        ref={folderInputRef}
                                        className="preview-dialog__input"
                                        value={folder}
                                        onChange={(event) => setFolder(event.target.value)}
                                        placeholder="/CORE/Regression/Auth"
                                    />
                                </PreviewField>
                            )}

                            {mode === 'keys' && (
                                <PreviewField label="Zephyr keys or ids">
                                    <textarea
                                        ref={refsInputRef}
                                        className="preview-dialog__textarea"
                                        value={refsText}
                                        onChange={(event) => setRefsText(event.target.value)}
                                        placeholder={'PROD-T6079\nPROD-T6209\n6078'}
                                        rows={6}
                                    />
                                </PreviewField>
                            )}

                            <PreviewField label="Raw query override">
                                <textarea
                                    className="preview-dialog__textarea"
                                    value={rawQuery}
                                    onChange={(event) => setRawQuery(event.target.value)}
                                    placeholder={'Optional. Example: projectKey = "PROD" AND folder = "/CORE/Auth"'}
                                    rows={4}
                                />
                            </PreviewField>

                            <div style={inlineRowStyle}>
                                <div style={{ flex: 1, minWidth: 140 }}>
                                    <PreviewField label="Max results">
                                        <input
                                            className="preview-dialog__input"
                                            value={maxResults}
                                            onChange={(event) => setMaxResults(event.target.value)}
                                            inputMode="numeric"
                                            placeholder="100"
                                        />
                                    </PreviewField>
                                </div>
                                <label style={checkboxLabelStyle}>
                                    <input
                                        type="checkbox"
                                        checked={mirrorRemoteFolders}
                                        onChange={(event) => setMirrorRemoteFolders(event.target.checked)}
                                    />
                                    Mirror Zephyr folders
                                </label>
                            </div>

                            <PreviewHint>
                                Project and folder scopes use the Zephyr search API. Key-set scope fetches each case directly.
                            </PreviewHint>
                        </PreviewCard>

                        {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

                        <div className="preview-dialog__button-row">
                            <PreviewButton type="submit" tone="primary" disabled={!canPreview}>
                                {loading ? 'Loading preview...' : 'Load preview'}
                            </PreviewButton>
                            <PreviewButton type="button" tone="ghost" onClick={onClose} disabled={loading || applying}>
                                Close
                            </PreviewButton>
                        </div>
                    </form>
                )}
                content={(
                    <div style={columnStyle}>
                        {!preview ? (
                            <PreviewEmptyState title="Preview">
                                Select the import scope, load the preview, then review diffs before anything touches local tests.
                            </PreviewEmptyState>
                        ) : (
                            <>
                                <PreviewCard>
                                    <div className="preview-dialog__summary-row">
                                        <div>
                                            <div className="preview-dialog__card-title">Preview</div>
                                            <div className="preview-dialog__subtitle">
                                                Query: <code>{preview.query || 'direct key lookup'}</code>
                                            </div>
                                        </div>
                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="neutral">{preview.summary.total} total</PreviewBadge>
                                            <PreviewBadge tone="ok">{preview.summary.created} new</PreviewBadge>
                                            <PreviewBadge tone="info">{preview.summary.updates} updates</PreviewBadge>
                                            <PreviewBadge tone="warn">{preview.summary.conflicts} conflicts</PreviewBadge>
                                            <PreviewBadge tone="muted">{preview.summary.unchanged} unchanged</PreviewBadge>
                                        </div>
                                    </div>
                                </PreviewCard>

                                {conflictItems.length > 0 ? (
                                    <PreviewCard title="Conflicts to review first">
                                        <PreviewToolbar>
                                            <PreviewToolbarGroup>
                                                <PreviewHint>
                                                    {conflictItems.length} remote cases match local tests. Review these before running replace.
                                                </PreviewHint>
                                            </PreviewToolbarGroup>
                                            <PreviewToolbarGroup align="end">
                                                <PreviewButton
                                                    tone="soft"
                                                    onClick={() => handleStatusFilterChange('conflict')}
                                                >
                                                    Only conflicts
                                                </PreviewButton>
                                                <PreviewButton
                                                    tone="ghost"
                                                    onClick={() => scrollToItem(firstConflictId)}
                                                    disabled={!firstConflictId}
                                                >
                                                    Jump to first conflict
                                                </PreviewButton>
                                            </PreviewToolbarGroup>
                                        </PreviewToolbar>

                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="info">{strategySummary.replace} replace</PreviewBadge>
                                            <PreviewBadge tone="muted">{strategySummary.skip} skip</PreviewBadge>
                                            <PreviewBadge tone="warn">
                                                {strategySummary['merge-locally-later']} merge later
                                            </PreviewBadge>
                                        </div>

                                        <div className="preview-dialog__quick-list">
                                            {conflictItems.slice(0, 4).map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="preview-dialog__quick-link"
                                                    onClick={() => scrollToItem(item.id)}
                                                >
                                                    {item.remoteName}
                                                </button>
                                            ))}
                                            {conflictItems.length > 4 ? (
                                                <PreviewHint>+ {conflictItems.length - 4} more conflicts in this preview</PreviewHint>
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
                                                active={statusFilter === 'new'}
                                                onClick={() => handleStatusFilterChange('new')}
                                            >
                                                New {preview.summary.created}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'update'}
                                                onClick={() => handleStatusFilterChange('update')}
                                            >
                                                Updates {preview.summary.updates}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'conflict'}
                                                onClick={() => handleStatusFilterChange('conflict')}
                                            >
                                                Conflicts {preview.summary.conflicts}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'unchanged'}
                                                onClick={() => handleStatusFilterChange('unchanged')}
                                            >
                                                Unchanged {preview.summary.unchanged}
                                            </PreviewFilterChip>
                                        </PreviewToolbarGroup>
                                        <PreviewToolbarGroup align="end">
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={showUnchanged}
                                                    onChange={(event) => handleShowUnchangedChange(event.target.checked)}
                                                />
                                                Show unchanged
                                            </label>
                                            {hiddenCount > 0 ? (
                                                <PreviewBadge tone="muted">{hiddenCount} hidden</PreviewBadge>
                                            ) : null}
                                        </PreviewToolbarGroup>
                                    </PreviewToolbar>
                                </PreviewCard>

                                {hiddenUnchangedCount > 0 && !showUnchanged && statusFilter !== 'unchanged' ? (
                                    <PreviewCard className="preview-dialog__collapsed-note">
                                        <PreviewHint>
                                            {hiddenUnchangedCount} unchanged items are collapsed to keep the review focused.
                                        </PreviewHint>
                                    </PreviewCard>
                                ) : null}

                                <div style={listStyle}>
                                    {items.length === 0 ? (
                                        <PreviewEmptyState title="No test cases found">
                                            The preview finished successfully, but Zephyr returned an empty set for this scope.
                                        </PreviewEmptyState>
                                    ) : visibleItems.length === 0 ? (
                                        <PreviewEmptyState title="No items match the current filters">
                                            Adjust the status filters to continue reviewing this batch.
                                        </PreviewEmptyState>
                                    ) : (
                                        visibleItems.map((item) => (
                                            <PreviewItemCard
                                                key={item.id}
                                                item={item}
                                                strategy={strategies[item.id] ?? item.strategy}
                                                onChangeStrategy={(value) =>
                                                    setStrategies((current) => ({ ...current, [item.id]: value }))
                                                }
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
                                        <PreviewBadge tone="info">{replaceCount} replace</PreviewBadge>
                                        {hiddenCount > 0 ? <PreviewBadge tone="muted">{hiddenCount} hidden</PreviewBadge> : null}
                                    </div>
                                    <div className="preview-dialog__button-row">
                                        <PreviewButton
                                            tone="ghost"
                                            onClick={() => {
                                                setStatusFilter('all')
                                                setShowUnchanged(false)
                                            }}
                                            disabled={applying || loading}
                                        >
                                            Reset filters
                                        </PreviewButton>
                                        <PreviewButton
                                            tone="primary"
                                            disabled={applying || loading || items.length === 0}
                                            onClick={handleApply}
                                        >
                                            {applying ? 'Applying...' : 'Apply import'}
                                        </PreviewButton>
                                    </div>
                                </PreviewStickyBar>
                            </>
                        )}
                    </div>
                )}
            />
        </PreviewDialog>
    )
}

function PreviewItemCard({
    item,
    strategy,
    onChangeStrategy,
    containerRef,
}: {
    item: ZephyrImportPreviewItem
    strategy: ZephyrImportStrategy
    onChangeStrategy(value: ZephyrImportStrategy): void
    containerRef?: (node: HTMLDivElement | null) => void
}) {
    const statusTone =
        item.status === 'new'
            ? 'ok'
            : item.status === 'update'
                ? 'info'
                : item.status === 'conflict'
                    ? 'warn'
                    : 'muted'

    const options: Array<{ value: ZephyrImportStrategy; label: string }> = [
        ...(!item.replaceDisabled ? [{ value: 'replace' as const, label: 'Replace local' }] : []),
        { value: 'skip' as const, label: 'Skip' },
        { value: 'merge-locally-later' as const, label: 'Merge locally later' },
    ]

    return (
        <div ref={containerRef} tabIndex={-1}>
            <PreviewCard>
                <div className="preview-dialog__summary-row">
                    <div style={{ minWidth: 0 }}>
                        <div className="preview-dialog__card-title">{item.remoteName}</div>
                        <div className="preview-dialog__subtitle">
                            <span>{item.remoteId}</span>
                            {item.remoteFolder ? ` / ${item.remoteFolder}` : ''}
                        </div>
                    </div>
                    <PreviewBadge tone={statusTone}>{item.status}</PreviewBadge>
                </div>

                <PreviewHint>{item.reason}</PreviewHint>

                <PreviewInfoGrid>
                    <PreviewInfoPair label="Local test" value={item.localName ?? 'Will be created'} />
                    <PreviewInfoPair label="Local folder" value={item.localFolder ?? '-'} />
                    <PreviewInfoPair label="Import into" value={item.targetFolderLabel} />
                    <PreviewInfoPair label="Matches" value={String(item.localMatchIds.length || 0)} />
                </PreviewInfoGrid>

                {item.diffs.length > 0 ? (
                    <div style={listStyle}>
                        {item.diffs.map((diff) => (
                            <PreviewDiffCard
                                key={`${item.id}:${diff.field}`}
                                title={diff.label}
                                leftLabel="Local"
                                rightLabel="Remote"
                                leftText={diff.local}
                                rightText={diff.remote}
                                stepRows={diff.stepRows}
                                leftSide="local"
                                rightSide="remote"
                            />
                        ))}
                    </div>
                ) : null}

                <PreviewField label="Conflict strategy">
                    <select
                        className="preview-dialog__select"
                        value={strategy}
                        onChange={(event) => onChangeStrategy(event.target.value as ZephyrImportStrategy)}
                        disabled={item.status === 'unchanged'}
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </PreviewField>
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

const tabRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
}

const tabButtonStyle: React.CSSProperties = {
    border: '1px solid #d7e1ef',
    background: '#f6f9ff',
    borderRadius: 999,
    padding: '7px 12px',
    cursor: 'pointer',
    color: '#39557e',
    fontWeight: 600,
}

const tabButtonActiveStyle: React.CSSProperties = {
    background: '#e8f0ff',
    borderColor: '#9db7ef',
    color: '#1f4f95',
}

const inlineRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'end',
    flexWrap: 'wrap',
}

const checkboxLabelStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#40506a',
}
