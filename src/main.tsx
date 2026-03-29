import React from 'react'
import { createRoot } from 'react-dom/client'
import type { Folder, TestCase } from '@core/domain'
import { buildExport } from '@core/export'
import { findNode, findParentFolder, isFolder } from '@core/tree'
import { describeFolderPath, type ZephyrImportPreview } from '@core/zephyrImport'
import type { ZephyrPublishPreview } from '@core/zephyrPublish'
import { Toolbar } from './ui/Toolbar'
import { SettingsModal } from './ui/Settings'
import { Tree } from './ui/Tree'
import { UiKit, useToast } from './ui/UiKit'
import { UiPreferencesProvider, useUiPreferences } from './ui/preferences'
import { useAppState } from './ui/useAppState'
import { ZephyrImportModal } from './ui/ZephyrImportModal'
import { ZephyrPublishModal } from './ui/ZephyrPublishModal'
import { useStoredToggle } from './ui/useStoredToggle'
import './ui/theme.css'

const TestEditor = React.lazy(() =>
    import('./ui/testEditor/TestEditor').then((module) => ({ default: module.TestEditor }))
)
import type { TestEditorHandle } from './ui/testEditor/TestEditor'

type SelectionSummary = {
    kind: 'none' | 'root' | 'folder' | 'test'
    title: string
    subtitle: string
    pathLabel: string
    folderCount: number
    testCount: number
    directChildrenCount: number
}

function AppShell() {
    const app = useAppState()
    const editorRef = React.useRef<TestEditorHandle | null>(null)
    const { push } = useToast()
    const { t } = useUiPreferences()
    const [settingsOpen, setSettingsOpen] = React.useState(false)
    const [importOpen, setImportOpen] = React.useState(false)
    const [publishOpen, setPublishOpen] = React.useState(false)
    const [syncCenterOpen, setSyncCenterOpen] = React.useState(false)
    const [previewAll, setPreviewAll] = useStoredToggle('test-editor.preview-all', false)
    const [compactWorkspace, setCompactWorkspace] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 980 : false
    )

    const handleSave = React.useCallback(async () => {
        editorRef.current?.commit?.()
        await app.save()
        push({ kind: 'success', text: t('toast.changesSaved'), ttl: 2200 })
    }, [app, push, t])

    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const modifier = isMac ? event.metaKey : event.ctrlKey
            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault()
                void handleSave()
            }
        }

        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
    }, [handleSave])

    React.useEffect(() => {
        const onResize = () => setCompactWorkspace(window.innerWidth < 980)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const handleExport = React.useCallback(async () => {
        editorRef.current?.commit?.()

        if (!app.state || !app.selectedId) {
            push({ kind: 'error', text: t('toast.selectCaseBeforeExport'), ttl: 2500 })
            return
        }

        const node = findNode(app.state.root, app.selectedId)
        if (!node || isFolder(node)) {
            push({ kind: 'error', text: t('toast.exportOnlyForCase'), ttl: 2500 })
            return
        }

        try {
            const exported = buildExport(node, app.state)
            const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `test-${node.name || node.id}.json`
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            URL.revokeObjectURL(url)

            push({ kind: 'success', text: t('toast.caseExported'), ttl: 2500 })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.exportFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 3500,
            })
        }
    }, [app, push, t])

    const handleApplyImport = React.useCallback(
        async (preview: ZephyrImportPreview) => {
            setSyncCenterOpen(false)
            const result = await app.applyZephyrImport(preview)
            push({
                kind: 'success',
                text: t('toast.importApplied', result),
                ttl: 0,
            })
            return result
        },
        [app, push, t]
    )

    const handleApplyPublish = React.useCallback(
        async (preview: ZephyrPublishPreview) => {
            setSyncCenterOpen(false)
            const result = await app.publishZephyr(preview)
            push({
                kind: result.failed ? 'error' : 'success',
                text: t('toast.publishFinished', result),
                ttl: 0,
            })
            return result
        },
        [app, push, t]
    )

    const handlePull = React.useCallback(async () => {
        try {
            const result = await app.pull()
            if (result.status === 'ok') {
                push({
                    kind: 'success',
                    text: t('toast.pullSuccess', { externalId: result.externalId || 'Zephyr' }),
                    ttl: 0,
                })
                return
            }

            push({
                kind: 'error',
                text: t(result.status === 'no-link' ? 'toast.pullNoLink' : 'toast.pullNoSelection'),
                ttl: 0,
            })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.pullFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 0,
            })
        }
    }, [app, push, t])

    const handleQuickSync = React.useCallback(async () => {
        try {
            const result = await app.syncAll()
            push({
                kind: 'success',
                text: t('toast.quickSyncSuccess', { count: result.count }),
                ttl: 0,
            })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.quickSyncFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 0,
            })
        }
    }, [app, push, t])

    const selectWithCommit = React.useCallback(
        (id: string) => {
            editorRef.current?.commit?.()
            app.select(id)
        },
        [app]
    )

    if (!app.state) {
        return (
            <div style={{ padding: 16, fontFamily: 'system-ui' }}>
                <h1>{t('app.loading')}</h1>
            </div>
        )
    }

    const selected = app.selectedId ? findNode(app.state.root, app.selectedId) : null
    const selectedTest = selected && !isFolder(selected) ? selected : null
    const allTests = app.mapAllTests()
    const importDestination = app.getImportDestination()
    const publishSelection = app.getPublishSelection()
    const selectionSummary = buildSelectionSummary(app.state.root, selected, t)

    const canDelete = !!selected && selected.id !== app.state.root.id
    const canExport = !!selectedTest
    const canPull = !!selectedTest
    const canPublish = publishSelection.tests.length > 0
    const canSyncAll = allTests.some((test) => (test.links?.length ?? 0) > 0)

    const rightPane = selectedTest ? (
        <React.Suspense fallback={<div style={{ padding: 16 }}>{t('app.loadingEditor')}</div>}>
            <TestEditor
                ref={editorRef}
                test={selectedTest}
                onChange={(patch) => app.updateTest(selectedTest.id, patch)}
                focusStepId={app.focusStepId}
                allTests={allTests}
                sharedSteps={app.state.sharedSteps}
                onAddSharedStep={app.addSharedStep}
                onAddSharedStepFromStep={app.addSharedStepFromStep}
                onUpdateSharedStep={app.updateSharedStep}
                onDeleteSharedStep={app.deleteSharedStep}
                onInsertSharedReference={(sharedId: string) => app.insertSharedReference(selectedTest.id, sharedId)}
                onOpenStep={app.openStep}
                onOpenTest={app.select}
                previewMode={previewAll ? 'preview' : 'raw'}
            />
        </React.Suspense>
    ) : (
        <ScopeOverviewPanel
            summary={selectionSummary}
            importDestinationLabel={importDestination.label}
            publishSelectionLabel={publishSelection.label}
            publishCount={publishSelection.tests.length}
            t={t}
            onOpenImport={() => setImportOpen(true)}
            onOpenPublish={() => setPublishOpen(true)}
            onAddFolder={app.addFolder}
            onAddTest={app.addTest}
        />
    )

    return (
        <div
            style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'system-ui',
            }}
        >
            <Toolbar
                selectionLabel={selectionSummary.pathLabel}
                importDestinationLabel={importDestination.label}
                publishSelectionLabel={publishSelection.label}
                publishCount={publishSelection.tests.length}
                onAddFolder={app.addFolder}
                onAddTest={app.addTest}
                onDelete={app.removeSelected}
                onSave={() => void handleSave()}
                onExport={() => void handleExport()}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleSyncCenter={() => setSyncCenterOpen((current) => !current)}
                onTogglePreviewMode={selectedTest ? () => setPreviewAll((current) => !current) : undefined}
                syncCenterOpen={syncCenterOpen}
                canDelete={canDelete}
                canExport={canExport}
                canTogglePreview={!!selectedTest}
                previewMode={previewAll ? 'preview' : 'raw'}
            />

            <div
                style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: compactWorkspace ? '1fr' : 'minmax(260px, 320px) 1fr',
                    gridTemplateRows: compactWorkspace ? 'minmax(210px, 34vh) 1fr' : undefined,
                    minHeight: 0,
                }}
            >
                <div
                    style={{
                        borderRight: compactWorkspace ? 'none' : '1px solid var(--border)',
                        borderBottom: compactWorkspace ? '1px solid var(--border)' : 'none',
                        overflow: 'auto',
                        background: 'var(--bg-soft)',
                    }}
                >
                    <Tree
                        root={app.state.root}
                        sharedSteps={app.state.sharedSteps}
                        dirtyTestIds={app.dirtyTestIds}
                        selectedId={app.selectedId}
                        onSelect={selectWithCommit}
                        onMove={app.moveNode}
                        onCreateFolderAt={app.addFolderAt}
                        onCreateTestAt={app.addTestAt}
                        onRename={app.renameNode}
                        onDelete={app.deleteNodeById}
                        onOpenStep={app.openStep}
                    />
                </div>
                <div
                    style={{
                        position: 'relative',
                        overflow: 'hidden',
                        background: 'var(--bg)',
                    }}
                >
                    <div style={{ height: '100%', overflow: 'auto' }}>{rightPane}</div>
                    {syncCenterOpen ? (
                        <>
                            <button
                                type="button"
                                aria-label="Close sync center"
                                onClick={() => setSyncCenterOpen(false)}
                                style={syncBackdropStyle}
                            />
                            <SyncCenterPanel
                                selectionLabel={selectionSummary.pathLabel}
                                importDestinationLabel={importDestination.label}
                                publishSelectionLabel={publishSelection.label}
                                publishCount={publishSelection.tests.length}
                                t={t}
                                canPull={canPull}
                                canPublish={canPublish}
                                canSyncAll={canSyncAll}
                                onClose={() => setSyncCenterOpen(false)}
                                onOpenImport={() => setImportOpen(true)}
                                onOpenPublish={() => setPublishOpen(true)}
                                onPull={() => void handlePull()}
                                onSyncAll={() => void handleQuickSync()}
                            />
                        </>
                    ) : null}
                </div>
            </div>

            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <ZephyrImportModal
                open={importOpen}
                destinationLabel={importDestination.label}
                onClose={() => setImportOpen(false)}
                onPreview={(request) => app.previewZephyrImport(request)}
                onApply={handleApplyImport}
            />
            <ZephyrPublishModal
                open={publishOpen}
                selectionLabel={publishSelection.label}
                onClose={() => setPublishOpen(false)}
                onPreview={() => app.previewZephyrPublish()}
                onApply={handleApplyPublish}
            />
        </div>
    )
}

function App() {
    return (
        <UiPreferencesProvider>
            <UiKit>
                <AppShell />
            </UiKit>
        </UiPreferencesProvider>
    )
}

function ScopeOverviewPanel({
    summary,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    t,
    onOpenImport,
    onOpenPublish,
    onAddFolder,
    onAddTest,
}: {
    summary: SelectionSummary
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    t: (key: any, params?: Record<string, string | number>) => string
    onOpenImport(): void
    onOpenPublish(): void
    onAddFolder(): void
    onAddTest(): void
}) {
    return (
        <div
            style={{
                padding: 20,
                display: 'grid',
                gap: 16,
                maxWidth: 920,
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gap: 6,
                    padding: 18,
                    borderRadius: 18,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                }}
            >
                <div style={eyebrowStyle}>
                    {summary.kind === 'root' ? t('overview.zephyrWorkspace') : summary.kind === 'folder' ? t('tree.folder') : t('toolbar.editor')}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-strong)' }}>{summary.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>{summary.subtitle}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    <code>{summary.pathLabel}</code>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                }}
            >
                <OverviewStat label={t('tree.folder')} value={String(summary.folderCount)} hint={t('tree.itemCount', { count: summary.folderCount })} />
                <OverviewStat label={t('overview.casesInScope')} value={String(summary.testCount)} hint={t('overview.casesInScopeHint')} />
                <OverviewStat label={t('tree.cases')} value={String(summary.directChildrenCount)} hint={t('tree.itemCount', { count: summary.directChildrenCount })} />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 14,
                }}
            >
                <ActionCard
                    label={t('overview.importFromZephyr')}
                    title={importDestinationLabel}
                    description={t('overview.importFromZephyrDescription')}
                    tone="info"
                    actionLabel={t('overview.openImport')}
                    onAction={onOpenImport}
                />
                <ActionCard
                    label={t('overview.publishToZephyr')}
                    title={publishSelectionLabel}
                    description={
                        publishCount === 0
                            ? t('toolbar.publishScopeEmpty')
                            : publishCount === 1
                                ? t('toolbar.publishScopeLabel', { label: publishSelectionLabel })
                                : t('toolbar.publishScopeCount', { count: publishCount })
                    }
                    tone={publishCount === 0 ? 'neutral' : publishCount > 1 ? 'warn' : 'danger'}
                    actionLabel={t('overview.openPublish')}
                    onAction={publishCount > 0 ? onOpenPublish : undefined}
                />
                <ActionCard
                    label={t('toolbar.local')}
                    title={t('toolbar.editor')}
                    description={t('overview.zephyrWorkspace')}
                    tone="neutral"
                    extra={(
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <QuickActionButton onClick={onAddFolder}>{t('overview.newFolder')}</QuickActionButton>
                            <QuickActionButton onClick={onAddTest}>{t('overview.newCase')}</QuickActionButton>
                        </div>
                    )}
                />
            </div>
        </div>
    )
}

function OverviewStat({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div
            style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                padding: '14px 16px',
                display: 'grid',
                gap: 4,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: 'var(--text-strong)' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{hint}</div>
        </div>
    )
}

function ActionCard({
    label,
    title,
    description,
    tone,
    actionLabel,
    onAction,
    extra,
}: {
    label: string
    title: string
    description: string
    tone: 'neutral' | 'info' | 'warn' | 'danger'
    actionLabel?: string
    onAction?: () => void
    extra?: React.ReactNode
}) {
    const accents =
        tone === 'info'
            ? { border: 'var(--accent-border)', background: 'var(--accent-bg)', label: 'var(--accent-text)' }
            : tone === 'warn'
                ? { border: 'var(--warning-border)', background: 'var(--warning-bg)', label: 'var(--warning-text)' }
                : tone === 'danger'
                    ? { border: 'var(--danger-border)', background: 'var(--danger-bg)', label: 'var(--danger-text)' }
                    : { border: 'var(--border)', background: 'var(--bg-elevated)', label: 'var(--text-muted)' }

    return (
        <div
            style={{
                border: `1px solid ${accents.border}`,
                borderRadius: 14,
                background: accents.background,
                padding: 16,
                display: 'grid',
                gap: 8,
                alignContent: 'start',
            }}
        >
            <div style={{ ...eyebrowStyle, color: accents.label }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted)' }}>{description}</div>
            {actionLabel && onAction ? <QuickActionButton onClick={onAction}>{actionLabel}</QuickActionButton> : null}
            {extra}
        </div>
    )
}

function QuickActionButton({
    children,
    onClick,
}: {
    children: React.ReactNode
    onClick(): void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                border: '1px solid var(--accent-border)',
                background: 'var(--bg-elevated)',
                color: 'var(--accent-text)',
                borderRadius: 10,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    )
}

function SyncCenterPanel({
    selectionLabel,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    t,
    canPull,
    canPublish,
    canSyncAll,
    onClose,
    onOpenImport,
    onOpenPublish,
    onPull,
    onSyncAll,
}: {
    selectionLabel: string
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    t: (key: any, params?: Record<string, string | number>) => string
    canPull: boolean
    canPublish: boolean
    canSyncAll: boolean
    onClose(): void
    onOpenImport(): void
    onOpenPublish(): void
    onPull(): void
    onSyncAll(): void
}) {
    return (
        <aside style={syncPanelStyle} aria-label={t('toolbar.syncCenter')}>
            <div style={syncPanelHeaderStyle}>
                <div style={{ display: 'grid', gap: 4 }}>
                    <div style={eyebrowStyle}>{t('toolbar.syncCenter')}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>{t('overview.zephyrWorkspace')}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                        {t('toolbar.syncCenterTitle')}
                    </div>
                </div>
                <button type="button" onClick={onClose} style={syncPanelCloseStyle}>
                    {t('sync.close')}
                </button>
            </div>

            <div style={syncPanelBodyStyle}>
                <SyncInfoCard label={t('toolbar.editor')} value={selectionLabel} hint={selectionLabel} />
                <SyncInfoCard label={t('sync.importTarget')} value={importDestinationLabel} hint={t('sync.importTargetHint')} />
                <SyncInfoCard
                    label={t('sync.publishScope')}
                    value={publishCount === 0 ? t('toolbar.publishScopeEmpty') : publishCount === 1 ? publishSelectionLabel : t('toolbar.publishScopeCount', { count: publishCount })}
                    hint={t('sync.publishScopeHint')}
                    tone={publishCount > 0 ? 'warn' : 'neutral'}
                />

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>{t('toolbar.panels')}</div>
                    <button type="button" onClick={onOpenImport} style={syncPrimaryButtonStyle}>
                        {t('sync.importFromZephyr')}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenPublish}
                        disabled={!canPublish}
                        style={{
                            ...syncDangerButtonStyle,
                            opacity: canPublish ? 1 : 0.45,
                            cursor: canPublish ? 'pointer' : 'default',
                        }}
                    >
                        {t('sync.publishToZephyr')}
                    </button>
                </div>

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>{t('toolbar.more')}</div>
                    <button
                        type="button"
                        onClick={onPull}
                        disabled={!canPull}
                        style={{
                            ...syncSecondaryButtonStyle,
                            opacity: canPull ? 1 : 0.45,
                            cursor: canPull ? 'pointer' : 'default',
                        }}
                    >
                        {t('sync.pullCurrent')}
                    </button>
                    <button
                        type="button"
                        onClick={onSyncAll}
                        disabled={!canSyncAll}
                        style={{
                            ...syncSecondaryButtonStyle,
                            opacity: canSyncAll ? 1 : 0.45,
                            cursor: canSyncAll ? 'pointer' : 'default',
                        }}
                    >
                        {t('sync.quickSync')}
                    </button>
                </div>
            </div>
        </aside>
    )
}

function SyncInfoCard({
    label,
    value,
    hint,
    tone = 'neutral',
}: {
    label: string
    value: string
    hint: string
    tone?: 'neutral' | 'warn'
}) {
    return (
        <div
            style={{
                border: `1px solid ${tone === 'warn' ? 'var(--warning-border)' : 'var(--border-soft)'}`,
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                padding: 14,
                display: 'grid',
                gap: 6,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{hint}</div>
        </div>
    )
}

function buildSelectionSummary(
    root: Folder,
    selected: Folder | TestCase | null,
    t: (key: any, params?: Record<string, string | number>) => string
): SelectionSummary {
    if (!selected) {
        return {
            kind: 'none',
            title: t('toolbar.editor'),
            subtitle: t('toolbar.syncCenterTitle'),
            pathLabel: describeFolderPath(root, root.id),
            folderCount: countNestedFolders(root),
            testCount: countTests(root),
            directChildrenCount: root.children.length,
        }
    }

    if (isFolder(selected)) {
        const isRoot = selected.id === root.id
        return {
            kind: isRoot ? 'root' : 'folder',
            title: isRoot ? t('overview.zephyrWorkspace') : selected.name,
            subtitle: isRoot ? t('overview.importFromZephyrDescription') : t('sync.publishScopeHint'),
            pathLabel: describeFolderPath(root, selected.id),
            folderCount: countNestedFolders(selected),
            testCount: countTests(selected),
            directChildrenCount: selected.children.length,
        }
    }

    const parentId = findParentFolder(root, selected.id)?.id ?? root.id
    return {
        kind: 'test',
        title: selected.name,
        subtitle: t('editor.testCase'),
        pathLabel: `${describeFolderPath(root, parentId)} / ${selected.name}`,
        folderCount: 0,
        testCount: 1,
        directChildrenCount: selected.steps.length,
    }
}

function countTests(folder: Folder): number {
    let total = 0
    for (const child of folder.children) {
        if (isFolder(child)) total += countTests(child)
        else total += 1
    }
    return total
}

function countNestedFolders(folder: Folder): number {
    let total = 0
    for (const child of folder.children) {
        if (!isFolder(child)) continue
        total += 1
        total += countNestedFolders(child)
    }
    return total
}

const eyebrowStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-dim)',
}

const syncBackdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: 'none',
    background: 'var(--bg-overlay)',
    cursor: 'pointer',
}

const syncPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    bottom: 12,
    width: 'min(336px, calc(100vw - 24px))',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: 14,
    padding: 16,
    border: '1px solid var(--border)',
    borderRadius: 18,
    background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
    boxShadow: 'var(--shadow-strong)',
    zIndex: 5,
    backdropFilter: 'blur(10px)',
}

const syncPanelHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
}

const syncPanelCloseStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '7px 10px',
    fontWeight: 700,
    cursor: 'pointer',
}

const syncPanelBodyStyle: React.CSSProperties = {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
    overflow: 'auto',
    paddingRight: 2,
}

const syncActionGroupStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: 14,
    border: '1px solid var(--border-soft)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
}

const syncActionGroupTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
}

const syncPrimaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent-text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
}

const syncDangerButtonStyle: React.CSSProperties = {
    border: '1px solid var(--danger-border)',
    background: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}

const syncSecondaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}

createRoot(document.getElementById('root')!).render(<App />)
