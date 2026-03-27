import * as React from 'react'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem, ZephyrPublishResult } from '@core/zephyrPublish'

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

export function ZephyrPublishModal({ open, selectionLabel, onClose, onPreview, onApply }: Props) {
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrPublishPreview | null>(null)
    const [publishMap, setPublishMap] = React.useState<Record<string, boolean>>({})
    const [confirmText, setConfirmText] = React.useState('')

    React.useEffect(() => {
        if (!open) return
        setError(null)
        setPreview(null)
        setPublishMap({})
        setConfirmText('')
    }, [open, selectionLabel])

    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading && !applying) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [applying, loading, onClose, open])

    if (!open) return null

    async function handlePreview() {
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview()
            setPreview(nextPreview)
            setPublishMap(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.publish])))
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

    const selectedCount = preview
        ? preview.items.filter((item) => publishMap[item.id] ?? item.publish).length
        : 0
    const canApply = !!preview && !loading && !applying && confirmText === 'PUBLISH' && selectedCount > 0

    return (
        <div style={backdrop} onMouseDown={onClose}>
            <div style={modal} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <div style={header}>
                    <div>
                        <div style={title}>Publish Local -&gt; Zephyr</div>
                        <div style={subtitle}>Scope: {selectionLabel}</div>
                    </div>
                    <button type="button" style={xButton} onClick={onClose} disabled={loading || applying}>
                        ×
                    </button>
                </div>

                <div style={body}>
                    <div style={leftColumn}>
                        <div style={card}>
                            <div style={cardTitle}>Dry-run</div>
                            <div style={hint}>
                                This preview compares local tests with current Zephyr state, then prepares a replace publish.
                                A local snapshot is created before the first write, and a publish log is saved after the run.
                            </div>
                        </div>

                        <div style={card}>
                            <div style={cardTitle}>Confirmation</div>
                            <div style={hint}>
                                Type <code>PUBLISH</code> to enable the mass replace action.
                            </div>
                            <input
                                className="input"
                                value={confirmText}
                                onChange={(event) => setConfirmText(event.target.value)}
                                placeholder="PUBLISH"
                            />
                        </div>

                        {error && <div style={errorBox}>{error}</div>}

                        <div style={footerRow}>
                            <button
                                type="button"
                                style={{ ...primaryButton, opacity: loading ? 0.7 : 1 }}
                                onClick={handlePreview}
                                disabled={loading || applying}
                            >
                                {loading ? 'Loading preview…' : 'Load dry-run'}
                            </button>
                            <button type="button" style={ghostButton} onClick={onClose} disabled={loading || applying}>
                                Close
                            </button>
                        </div>
                    </div>

                    <div style={rightColumn}>
                        {!preview ? (
                            <div style={{ ...card, ...emptyState }}>
                                <div style={cardTitle}>Preview</div>
                                <div style={hint}>Load the dry-run first to review create/update/blocked items.</div>
                            </div>
                        ) : (
                            <>
                                <div style={card}>
                                    <div style={summaryRow}>
                                        <div>
                                            <div style={cardTitle}>Publish preview</div>
                                            <div style={subtitle}>
                                                {preview.summary.total} tests in scope, {selectedCount} selected to publish
                                            </div>
                                        </div>
                                        <div style={summaryBadges}>
                                            <Badge tone="ok">{preview.summary.create} create</Badge>
                                            <Badge tone="info">{preview.summary.update} update</Badge>
                                            <Badge tone="muted">{preview.summary.skip} skip</Badge>
                                            <Badge tone="warn">{preview.summary.blocked} blocked</Badge>
                                        </div>
                                    </div>
                                </div>

                                <div style={previewList}>
                                    {preview.items.map((item) => (
                                        <PublishItemCard
                                            key={item.id}
                                            item={item}
                                            publish={publishMap[item.id] ?? item.publish}
                                            onToggle={(value) => setPublishMap((current) => ({ ...current, [item.id]: value }))}
                                        />
                                    ))}
                                </div>

                                <div style={footerRow}>
                                    <button
                                        type="button"
                                        style={{ ...dangerButton, opacity: canApply ? 1 : 0.65 }}
                                        disabled={!canApply}
                                        onClick={handleApply}
                                    >
                                        {applying ? 'Publishing…' : 'Publish to Zephyr'}
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

function PublishItemCard({
    item,
    publish,
    onToggle,
}: {
    item: ZephyrPublishPreviewItem
    publish: boolean
    onToggle(value: boolean): void
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
        <div style={itemCard}>
            <div style={itemHeader}>
                <div style={{ minWidth: 0 }}>
                    <div style={itemTitle}>{item.testName}</div>
                    <div style={itemMeta}>
                        <span>{item.externalId ?? 'New testcase'}</span>
                        {item.projectKey ? <span>{item.projectKey}</span> : null}
                        {item.folder ? <span>{item.folder}</span> : null}
                    </div>
                </div>
                <Badge tone={tone}>{item.status}</Badge>
            </div>

            <div style={itemReason}>{item.reason}</div>

            <label style={checkboxLabel}>
                <input
                    type="checkbox"
                    checked={publish}
                    disabled={item.status === 'blocked' || item.status === 'skip'}
                    onChange={(event) => onToggle(event.target.checked)}
                />
                Include in publish run
            </label>

            {item.attachmentWarnings.length > 0 && (
                <div style={warningBox}>
                    {item.attachmentWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                    ))}
                </div>
            )}

            {item.diffs.length > 0 && (
                <div style={diffList}>
                    {item.diffs.map((diff) => (
                        <div key={`${item.id}:${diff.field}`} style={diffCard}>
                            <div style={diffTitle}>{diff.label}</div>
                            <div style={diffCols}>
                                <div>
                                    <div style={diffLabel}>Remote</div>
                                    <div style={diffText}>{diff.remote}</div>
                                </div>
                                <div>
                                    <div style={diffLabel}>Local publish</div>
                                    <div style={diffText}>{diff.local}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function Badge({ tone, children }: { tone: 'ok' | 'info' | 'warn' | 'muted'; children: React.ReactNode }) {
    const style = tone === 'ok'
        ? badgeOk
        : tone === 'info'
            ? badgeInfo
            : tone === 'warn'
                ? badgeWarn
                : badgeMuted
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
    gridTemplateColumns: '320px minmax(0, 1fr)',
    minHeight: 0,
}

const leftColumn: React.CSSProperties = {
    padding: 18,
    overflow: 'auto',
    borderRight: '1px solid #dfe7f2',
    display: 'grid',
    alignContent: 'start',
    gap: 14,
}

const rightColumn: React.CSSProperties = {
    padding: 18,
    overflow: 'auto',
    display: 'grid',
    alignContent: 'start',
    gap: 14,
}

const card: React.CSSProperties = {
    border: '1px solid #dfe7f2',
    borderRadius: 16,
    background: '#fff',
    padding: 16,
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

const cardTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#20354f',
    marginBottom: 10,
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

const warningBox: React.CSSProperties = {
    border: '1px solid #f1d0c8',
    background: '#fff8f5',
    color: '#8a4332',
    borderRadius: 12,
    padding: '10px 12px',
    lineHeight: 1.45,
}

const emptyState: React.CSSProperties = {
    display: 'grid',
    gap: 8,
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

const dangerButton: React.CSSProperties = {
    border: '1px solid #b74a39',
    background: '#d15944',
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

const checkboxLabel: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#40506a',
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
