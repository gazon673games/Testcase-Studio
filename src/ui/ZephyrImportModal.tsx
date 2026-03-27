import * as React from 'react'
import type {
    ZephyrImportApplyResult,
    ZephyrImportMode,
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@core/zephyrImport'

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
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading && !applying) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [applying, loading, onClose, open])

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

    if (!open) return null

    async function handlePreview(event?: React.FormEvent) {
        event?.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview(request)
            setPreview(nextPreview)
            setStrategies(
                Object.fromEntries(nextPreview.items.map((item) => [item.id, item.strategy]))
            )
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

    return (
        <div style={backdrop} onMouseDown={onClose}>
            <div style={modal} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <div style={header}>
                    <div>
                        <div style={title}>Import From Zephyr</div>
                        <div style={subtitle}>Destination: {destinationLabel}</div>
                    </div>
                    <button type="button" style={xButton} onClick={onClose} disabled={loading || applying}>
                        ×
                    </button>
                </div>

                <div style={body}>
                    <form style={configColumn} onSubmit={handlePreview}>
                        <div style={card}>
                            <div style={cardTitle}>Scope</div>
                            <div style={tabRow}>
                                {(Object.keys(MODE_LABELS) as ZephyrImportMode[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        style={{ ...tabButton, ...(mode === value ? tabButtonActive : {}) }}
                                        onClick={() => setMode(value)}
                                    >
                                        {MODE_LABELS[value]}
                                    </button>
                                ))}
                            </div>

                            {mode !== 'keys' && (
                                <Field label="Project key">
                                    <input
                                        style={inputStyle}
                                        value={projectKey}
                                        onChange={(event) => setProjectKey(event.target.value)}
                                        placeholder="PROD"
                                    />
                                </Field>
                            )}

                            {mode === 'folder' && (
                                <Field label="Folder path">
                                    <input
                                        style={inputStyle}
                                        value={folder}
                                        onChange={(event) => setFolder(event.target.value)}
                                        placeholder="/CORE/Regression/Auth"
                                    />
                                </Field>
                            )}

                            {mode === 'keys' && (
                                <Field label="Zephyr keys or ids">
                                    <textarea
                                        style={textareaStyle}
                                        value={refsText}
                                        onChange={(event) => setRefsText(event.target.value)}
                                        placeholder={'PROD-T6079\nPROD-T6209\n6078'}
                                        rows={6}
                                    />
                                </Field>
                            )}

                            <Field label="Raw query override">
                                <textarea
                                    style={textareaStyle}
                                    value={rawQuery}
                                    onChange={(event) => setRawQuery(event.target.value)}
                                    placeholder='Optional. Example: projectKey = "PROD" AND folder = "/CORE/Auth"'
                                    rows={4}
                                />
                            </Field>

                            <div style={inlineRow}>
                                <Field label="Max results" style={{ flex: 1, margin: 0 }}>
                                    <input
                                        style={inputStyle}
                                        value={maxResults}
                                        onChange={(event) => setMaxResults(event.target.value)}
                                        inputMode="numeric"
                                        placeholder="100"
                                    />
                                </Field>
                                <label style={checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={mirrorRemoteFolders}
                                        onChange={(event) => setMirrorRemoteFolders(event.target.checked)}
                                    />
                                    Mirror Zephyr folders
                                </label>
                            </div>

                            <div style={hint}>
                                Project and folder scopes use the Zephyr search API. Key-set scope fetches each case directly.
                            </div>
                        </div>

                        {error && <div style={errorBox}>{error}</div>}

                        <div style={footerRow}>
                            <button
                                type="submit"
                                style={{ ...primaryButton, opacity: canPreview ? 1 : 0.65 }}
                                disabled={!canPreview}
                            >
                                {loading ? 'Loading preview…' : 'Load preview'}
                            </button>
                            <button type="button" style={ghostButton} onClick={onClose} disabled={loading || applying}>
                                Close
                            </button>
                        </div>
                    </form>

                    <div style={previewColumn}>
                        {!preview ? (
                            <div style={{ ...card, ...emptyState }}>
                                <div style={cardTitle}>Preview</div>
                                <div style={hint}>
                                    Select the import scope, load the preview, then review diffs before anything touches local tests.
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={card}>
                                    <div style={summaryRow}>
                                        <div>
                                            <div style={cardTitle}>Preview</div>
                                            <div style={subtitle}>
                                                Query: <code>{preview.query || 'direct key lookup'}</code>
                                            </div>
                                        </div>
                                        <div style={summaryBadges}>
                                            <Badge tone="neutral">{preview.summary.total} total</Badge>
                                            <Badge tone="ok">{preview.summary.created} new</Badge>
                                            <Badge tone="info">{preview.summary.updates} updates</Badge>
                                            <Badge tone="warn">{preview.summary.conflicts} conflicts</Badge>
                                            <Badge tone="muted">{preview.summary.unchanged} unchanged</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div style={previewList}>
                                    {preview.items.length === 0 ? (
                                        <div style={{ ...card, ...emptyState }}>
                                            <div style={cardTitle}>No test cases found</div>
                                            <div style={hint}>The preview finished successfully, but Zephyr returned an empty set for this scope.</div>
                                        </div>
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

                                <div style={footerRow}>
                                    <button
                                        type="button"
                                        style={{ ...primaryButton, opacity: applying ? 0.7 : 1 }}
                                        disabled={applying || loading || preview.items.length === 0}
                                        onClick={handleApply}
                                    >
                                        {applying ? 'Applying…' : 'Apply import'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
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
        <div style={itemCard}>
            <div style={itemHeader}>
                <div style={{ minWidth: 0 }}>
                    <div style={itemTitle}>{item.remoteName}</div>
                    <div style={itemMeta}>
                        <span>{item.remoteId}</span>
                        {item.remoteFolder ? <span>{item.remoteFolder}</span> : null}
                    </div>
                </div>
                <Badge tone={statusTone}>{item.status}</Badge>
            </div>

            <div style={itemReason}>{item.reason}</div>

            <div style={gridMeta}>
                <InfoPair label="Local test" value={item.localName ?? 'Will be created'} />
                <InfoPair label="Local folder" value={item.localFolder ?? '—'} />
                <InfoPair label="Import into" value={item.targetFolderLabel} />
                <InfoPair label="Matches" value={String(item.localMatchIds.length || 0)} />
            </div>

            {item.diffs.length > 0 && (
                <div style={diffList}>
                    {item.diffs.map((diff) => (
                        <div key={`${item.id}:${diff.field}`} style={diffCard}>
                            <div style={diffTitle}>{diff.label}</div>
                            <div style={diffCols}>
                                <div>
                                    <div style={diffLabel}>Local</div>
                                    <div style={diffText}>{diff.local}</div>
                                </div>
                                <div>
                                    <div style={diffLabel}>Remote</div>
                                    <div style={diffText}>{diff.remote}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={strategyRow}>
                <label style={fieldLabel}>Conflict strategy</label>
                <select
                    style={inputStyle}
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
            </div>
        </div>
    )
}

function Field({
    label,
    children,
    style,
}: {
    label: string
    children: React.ReactNode
    style?: React.CSSProperties
}) {
    return (
        <div style={{ marginBottom: 12, ...style }}>
            <div style={fieldLabel}>{label}</div>
            {children}
        </div>
    )
}

function InfoPair({ label, value }: { label: string; value: string }) {
    return (
        <div style={infoPair}>
            <div style={infoLabel}>{label}</div>
            <div style={infoValue}>{value}</div>
        </div>
    )
}

function Badge({ tone, children }: { tone: 'neutral' | 'ok' | 'info' | 'warn' | 'muted'; children: React.ReactNode }) {
    const style = tone === 'ok'
        ? badgeOk
        : tone === 'info'
            ? badgeInfo
            : tone === 'warn'
                ? badgeWarn
                : tone === 'muted'
                    ? badgeMuted
                    : badgeNeutral

    return <span style={{ ...badgeBase, ...style }}>{children}</span>
}

const backdrop: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11, 23, 39, 0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: 20,
}

const modal: React.CSSProperties = {
    width: 'min(1400px, 100%)',
    height: 'min(860px, 100%)',
    background: '#f8fafe',
    borderRadius: 18,
    boxShadow: '0 30px 90px rgba(15, 34, 58, 0.28)',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    overflow: 'hidden',
}

const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '18px 22px',
    borderBottom: '1px solid #dfe7f2',
    background: 'linear-gradient(180deg, #ffffff 0%, #f5f8fd 100%)',
}

const body: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '340px minmax(0, 1fr)',
    minHeight: 0,
}

const configColumn: React.CSSProperties = {
    padding: 18,
    overflow: 'auto',
    borderRight: '1px solid #dfe7f2',
    display: 'grid',
    alignContent: 'start',
    gap: 14,
}

const previewColumn: React.CSSProperties = {
    padding: 18,
    overflow: 'auto',
    display: 'grid',
    alignContent: 'start',
    gap: 14,
    minWidth: 0,
}

const card: React.CSSProperties = {
    border: '1px solid #dfe7f2',
    borderRadius: 16,
    background: '#fff',
    padding: 16,
}

const cardTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#20354f',
    marginBottom: 10,
}

const title: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: '#20354f',
}

const subtitle: React.CSSProperties = {
    color: '#607089',
    fontSize: 12,
    lineHeight: 1.45,
}

const xButton: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#5f6f88',
}

const tabRow: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
}

const tabButton: React.CSSProperties = {
    border: '1px solid #d7e1ef',
    background: '#f6f9ff',
    borderRadius: 999,
    padding: '7px 12px',
    cursor: 'pointer',
    color: '#39557e',
    fontWeight: 600,
}

const tabButtonActive: React.CSSProperties = {
    background: '#e8f0ff',
    borderColor: '#9db7ef',
    color: '#1f4f95',
}

const inlineRow: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'end',
    flexWrap: 'wrap',
}

const checkboxLabel: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#40506a',
}

const footerRow: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-start',
}

const primaryButton: React.CSSProperties = {
    border: '1px solid #2c67be',
    background: '#2f76d2',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
}

const ghostButton: React.CSSProperties = {
    border: '1px solid #d7e1ef',
    background: '#fff',
    color: '#385275',
    borderRadius: 10,
    padding: '10px 14px',
    fontWeight: 600,
    cursor: 'pointer',
}

const hint: React.CSSProperties = {
    color: '#64738b',
    fontSize: 13,
    lineHeight: 1.5,
}

const errorBox: React.CSSProperties = {
    border: '1px solid #efc5cb',
    background: '#fff4f5',
    color: '#8a2331',
    borderRadius: 12,
    padding: '10px 12px',
    lineHeight: 1.45,
}

const emptyState: React.CSSProperties = {
    display: 'grid',
    gap: 8,
}

const summaryRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'start',
    flexWrap: 'wrap',
}

const summaryBadges: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
}

const previewList: React.CSSProperties = {
    display: 'grid',
    gap: 12,
}

const itemCard: React.CSSProperties = {
    border: '1px solid #dfe7f2',
    borderRadius: 16,
    background: '#fff',
    padding: 16,
    display: 'grid',
    gap: 12,
}

const itemHeader: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'start',
}

const itemTitle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: '#20354f',
}

const itemMeta: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    color: '#6a7a92',
    fontSize: 12,
}

const itemReason: React.CSSProperties = {
    color: '#475872',
    fontSize: 13,
    lineHeight: 1.45,
}

const gridMeta: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
}

const infoPair: React.CSSProperties = {
    border: '1px solid #e7edf6',
    borderRadius: 12,
    padding: '10px 12px',
    background: '#fbfcff',
}

const infoLabel: React.CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    color: '#75849b',
    marginBottom: 4,
}

const infoValue: React.CSSProperties = {
    fontSize: 13,
    color: '#2a425f',
    lineHeight: 1.4,
}

const diffList: React.CSSProperties = {
    display: 'grid',
    gap: 10,
}

const diffCard: React.CSSProperties = {
    border: '1px solid #e7edf6',
    borderRadius: 12,
    padding: 12,
    background: '#fbfcff',
}

const diffTitle: React.CSSProperties = {
    fontWeight: 700,
    color: '#253d5d',
    marginBottom: 8,
}

const diffCols: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 10,
}

const diffLabel: React.CSSProperties = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    color: '#6d7d94',
    marginBottom: 4,
}

const diffText: React.CSSProperties = {
    color: '#304863',
    lineHeight: 1.45,
    fontSize: 13,
}

const strategyRow: React.CSSProperties = {
    display: 'grid',
    gap: 6,
}

const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: '#56657e',
    marginBottom: 6,
    fontWeight: 600,
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cfd8e6',
    borderRadius: 10,
    background: '#fff',
    padding: '10px 12px',
    fontSize: 14,
    color: '#243951',
    outline: 'none',
}

const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: 92,
    fontFamily: 'inherit',
}

const badgeBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    padding: '0 9px',
    borderRadius: 999,
    border: '1px solid transparent',
    fontSize: 12,
    fontWeight: 700,
}

const badgeNeutral: React.CSSProperties = {
    background: '#eef4ff',
    borderColor: '#cfdcf5',
    color: '#2e568c',
}

const badgeOk: React.CSSProperties = {
    background: '#eef8ef',
    borderColor: '#cfe8cf',
    color: '#2f6a39',
}

const badgeInfo: React.CSSProperties = {
    background: '#eef4ff',
    borderColor: '#cfe0ff',
    color: '#2f5ca0',
}

const badgeWarn: React.CSSProperties = {
    background: '#fff4f2',
    borderColor: '#f1d0c8',
    color: '#8a4332',
}

const badgeMuted: React.CSSProperties = {
    background: '#f3f5f8',
    borderColor: '#dfe4eb',
    color: '#67758c',
}
