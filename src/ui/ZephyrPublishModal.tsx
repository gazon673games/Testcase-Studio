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
    PreviewHint,
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

export function ZephyrPublishModal({ open, selectionLabel, onClose, onPreview, onApply }: Props) {
    const loadButtonRef = React.useRef<HTMLButtonElement | null>(null)
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

                                <div style={listStyle}>
                                    {preview.items.map((item) => (
                                        <PublishItemCard
                                            key={item.id}
                                            item={item}
                                            publish={publishMap[item.id] ?? item.publish}
                                            onToggle={(value) => setPublishMap((current) => ({ ...current, [item.id]: value }))}
                                        />
                                    ))}
                                </div>

                                <div className="preview-dialog__button-row">
                                    <PreviewButton tone="danger" disabled={!canApply} onClick={handleApply}>
                                        {applying ? 'Publishing...' : 'Publish to Zephyr'}
                                    </PreviewButton>
                                </div>
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
