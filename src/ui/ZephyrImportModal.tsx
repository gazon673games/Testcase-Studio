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
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
} from './PreviewDialog'

type Props = {
    open: boolean
    destinationLabel: string
    onClose(): void
    onPreview(request: Omit<ZephyrImportRequest, 'destinationFolderId'>): Promise<ZephyrImportPreview>
    onApply(preview: ZephyrImportPreview): Promise<ZephyrImportApplyResult>
}

const MODE_LABELS: Record<ZephyrImportMode, string> = {
    project: 'Project',
    folder: 'Folder',
    keys: 'Key set',
}

export function ZephyrImportModal({ open, destinationLabel, onClose, onPreview, onApply }: Props) {
    const projectInputRef = React.useRef<HTMLInputElement | null>(null)
    const folderInputRef = React.useRef<HTMLInputElement | null>(null)
    const refsInputRef = React.useRef<HTMLTextAreaElement | null>(null)
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

    React.useEffect(() => {
        if (!open) return
        setError(null)
        setPreview(null)
        setStrategies({})
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

    async function handlePreview(event?: React.FormEvent) {
        event?.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview(request)
            setPreview(nextPreview)
            setStrategies(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.strategy])))
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

                                <div style={listStyle}>
                                    {preview.items.length === 0 ? (
                                        <PreviewEmptyState title="No test cases found">
                                            The preview finished successfully, but Zephyr returned an empty set for this scope.
                                        </PreviewEmptyState>
                                    ) : (
                                        preview.items.map((item) => (
                                            <PreviewItemCard
                                                key={item.id}
                                                item={item}
                                                strategy={strategies[item.id] ?? item.strategy}
                                                onChangeStrategy={(value) =>
                                                    setStrategies((current) => ({ ...current, [item.id]: value }))
                                                }
                                            />
                                        ))
                                    )}
                                </div>

                                <div className="preview-dialog__button-row">
                                    <PreviewButton
                                        tone="primary"
                                        disabled={applying || loading || preview.items.length === 0}
                                        onClick={handleApply}
                                    >
                                        {applying ? 'Applying...' : 'Apply import'}
                                    </PreviewButton>
                                </div>
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
}: {
    item: ZephyrImportPreviewItem
    strategy: ZephyrImportStrategy
    onChangeStrategy(value: ZephyrImportStrategy): void
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
