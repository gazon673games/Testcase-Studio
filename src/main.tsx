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
import { useAppState } from './ui/useAppState'
import { ZephyrImportModal } from './ui/ZephyrImportModal'
import { ZephyrPublishModal } from './ui/ZephyrPublishModal'

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
    const [settingsOpen, setSettingsOpen] = React.useState(false)
    const [importOpen, setImportOpen] = React.useState(false)
    const [publishOpen, setPublishOpen] = React.useState(false)
    const [syncCenterOpen, setSyncCenterOpen] = React.useState(false)
    const [compactWorkspace, setCompactWorkspace] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 980 : false
    )

    const handleSave = React.useCallback(async () => {
        editorRef.current?.commit?.()
        await app.save()
        push({ kind: 'success', text: 'Changes saved', ttl: 2200 })
    }, [app, push])

    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const modifier = isMac ? event.metaKey : event.ctrlKey
            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault()
                void handleSave()
            }
        }

        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [handleSave])

    React.useEffect(() => {
        const onResize = () => setCompactWorkspace(window.innerWidth < 980)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const handleExport = React.useCallback(async () => {
        editorRef.current?.commit?.()

        if (!app.state || !app.selectedId) {
            push({ kind: 'error', text: 'Select a case before export', ttl: 2500 })
            return
        }

        const node = findNode(app.state.root, app.selectedId)
        if (!node || isFolder(node)) {
            push({ kind: 'error', text: 'Export works only for a test case', ttl: 2500 })
            return
        }

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

        push({ kind: 'success', text: 'Case exported to JSON', ttl: 2500 })
    }, [app, push])

    const handleApplyImport = React.useCallback(
        async (preview: ZephyrImportPreview) => {
            setSyncCenterOpen(false)
            const result = await app.applyZephyrImport(preview)
            push({
                kind: 'success',
                text: `Import applied: ${result.created} created, ${result.updated} updated, ${result.drafts} drafts, ${result.skipped} skipped`,
                ttl: 3200,
            })
            return result
        },
        [app, push]
    )

    const handleApplyPublish = React.useCallback(
        async (preview: ZephyrPublishPreview) => {
            setSyncCenterOpen(false)
            const result = await app.publishZephyr(preview)
            push({
                kind: result.failed ? 'error' : 'success',
                text: `Publish finished: ${result.created} created, ${result.updated} updated, ${result.failed} failed. Snapshot: ${result.snapshotPath}. Log: ${result.logPath}`,
                ttl: 5200,
            })
            return result
        },
        [app, push]
    )

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
                <h1>Loading...</h1>
            </div>
        )
    }

    const selected = app.selectedId ? findNode(app.state.root, app.selectedId) : null
    const selectedTest = selected && !isFolder(selected) ? selected : null
    const allTests = app.mapAllTests()
    const importDestination = app.getImportDestination()
    const publishSelection = app.getPublishSelection()
    const selectionSummary = buildSelectionSummary(app.state.root, selected)

    const canDelete = !!selected && selected.id !== app.state.root.id
    const canExport = !!selectedTest
    const canPull = !!selectedTest && (selectedTest.links?.length ?? 0) > 0
    const canPublish = publishSelection.tests.length > 0
    const canSyncAll = allTests.some((test) => (test.links?.length ?? 0) > 0)

    const rightPane = selectedTest ? (
        <React.Suspense fallback={<div style={{ padding: 16 }}>Loading editor...</div>}>
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
            />
        </React.Suspense>
    ) : (
        <ScopeOverviewPanel
            summary={selectionSummary}
            importDestinationLabel={importDestination.label}
            publishSelectionLabel={publishSelection.label}
            publishCount={publishSelection.tests.length}
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
                syncCenterOpen={syncCenterOpen}
                canDelete={canDelete}
                canExport={canExport}
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
                        borderRight: compactWorkspace ? 'none' : '1px solid #eee',
                        borderBottom: compactWorkspace ? '1px solid #eee' : 'none',
                        overflow: 'auto',
                    }}
                >
                    <Tree
                        root={app.state.root}
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
                        background: '#f8fafc',
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
                                canPull={canPull}
                                canPublish={canPublish}
                                canSyncAll={canSyncAll}
                                onClose={() => setSyncCenterOpen(false)}
                                onOpenImport={() => setImportOpen(true)}
                                onOpenPublish={() => setPublishOpen(true)}
                                onPull={() => void app.pull()}
                                onSyncAll={() => void app.syncAll()}
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
        <UiKit>
            <AppShell />
        </UiKit>
    )
}

function ScopeOverviewPanel({
    summary,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    onOpenImport,
    onOpenPublish,
    onAddFolder,
    onAddTest,
}: {
    summary: SelectionSummary
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
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
                    border: '1px solid #e3e8f0',
                    background: '#ffffff',
                }}
            >
                <div style={eyebrowStyle}>
                    {summary.kind === 'root' ? 'Workspace' : summary.kind === 'folder' ? 'Folder' : 'Selection'}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#20354f' }}>{summary.title}</div>
                <div style={{ color: '#5f6e84', fontSize: 14, lineHeight: 1.5 }}>{summary.subtitle}</div>
                <div style={{ color: '#6f7d93', fontSize: 13 }}>
                    Path: <code>{summary.pathLabel}</code>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                }}
            >
                <OverviewStat label="Folders in scope" value={String(summary.folderCount)} hint="Nested local folders" />
                <OverviewStat label="Cases in scope" value={String(summary.testCount)} hint="Will participate in batch publish" />
                <OverviewStat label="Direct children" value={String(summary.directChildrenCount)} hint="Immediate items in current node" />
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 14,
                }}
            >
                <ActionCard
                    label="Import from Zephyr"
                    title={importDestinationLabel}
                    description="Preview-first import will create or replace local cases inside this destination."
                    tone="info"
                    actionLabel="Open import..."
                    onAction={onOpenImport}
                />
                <ActionCard
                    label="Publish to Zephyr"
                    title={publishSelectionLabel}
                    description={
                        publishCount === 0
                            ? 'There are no test cases in the current publish scope yet.'
                            : publishCount === 1
                            ? 'One test case is currently in publish scope.'
                            : `${publishCount} test cases are currently in publish scope.`
                    }
                    tone={publishCount === 0 ? 'neutral' : publishCount > 1 ? 'warn' : 'danger'}
                    actionLabel="Open publish..."
                    onAction={publishCount > 0 ? onOpenPublish : undefined}
                />
                <ActionCard
                    label="Local editing"
                    title="Create content"
                    description="Use the current folder as the destination for new cases and nested folders."
                    tone="neutral"
                    extra={(
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <QuickActionButton onClick={onAddFolder}>New Folder</QuickActionButton>
                            <QuickActionButton onClick={onAddTest}>New Case</QuickActionButton>
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
                border: '1px solid #e3e8f0',
                borderRadius: 14,
                background: '#fff',
                padding: '14px 16px',
                display: 'grid',
                gap: 4,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: '#22384f' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: '#68778e' }}>{hint}</div>
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
            ? { border: '#cfe0ff', background: '#f6f9ff', label: '#2d5fa9' }
            : tone === 'warn'
                ? { border: '#edd9b2', background: '#fffaf1', label: '#8b6408' }
                : tone === 'danger'
                    ? { border: '#e8c7c0', background: '#fff6f3', label: '#944332' }
                    : { border: '#e3e8f0', background: '#ffffff', label: '#5f6f84' }

    return (
        <div
            style={{
                border: `1px solid ${accents.border}`,
                borderRadius: 14,
                background: '#fff',
                padding: 16,
                display: 'grid',
                gap: 8,
                alignContent: 'start',
            }}
        >
            <div style={{ ...eyebrowStyle, color: accents.label }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#20354f' }}>{title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: '#5f6e84' }}>{description}</div>
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
                border: '1px solid #cad7ea',
                background: '#fff',
                color: '#264a76',
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
        <aside style={syncPanelStyle} aria-label="Sync center">
            <div style={syncPanelHeaderStyle}>
                <div style={{ display: 'grid', gap: 4 }}>
                    <div style={eyebrowStyle}>Sync Center</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#20354f' }}>Zephyr workspace</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: '#64748b' }}>
                        Sync is kept separate from editing so the current case stays front and center.
                    </div>
                </div>
                <button type="button" onClick={onClose} style={syncPanelCloseStyle}>
                    Close
                </button>
            </div>

            <div style={syncPanelBodyStyle}>
                <SyncInfoCard label="Current selection" value={selectionLabel} hint="This is the active local context in the editor." />
                <SyncInfoCard label="Import target" value={importDestinationLabel} hint="Imported cases land here unless you change scope." />
                <SyncInfoCard
                    label="Publish scope"
                    value={publishCount === 0 ? 'Nothing to publish' : publishCount === 1 ? publishSelectionLabel : `${publishCount} cases`}
                    hint="Preview first, then replace the matching content in Zephyr."
                    tone={publishCount > 0 ? 'warn' : 'neutral'}
                />

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>Planned sync</div>
                    <button type="button" onClick={onOpenImport} style={syncPrimaryButtonStyle}>
                        Import from Zephyr
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
                        Publish to Zephyr
                    </button>
                </div>

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>Fast actions</div>
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
                        Pull current case
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
                        Quick sync linked cases
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
                border: `1px solid ${tone === 'warn' ? '#ecd8b4' : '#e5ebf2'}`,
                borderRadius: 14,
                background: '#fff',
                padding: 14,
                display: 'grid',
                gap: 6,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#21364e' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: '#6b7a90' }}>{hint}</div>
        </div>
    )
}

function buildSelectionSummary(root: Folder, selected: Folder | TestCase | null): SelectionSummary {
    if (!selected) {
        return {
            kind: 'none',
            title: 'Nothing selected',
            subtitle: 'Select a case to edit it or pick a folder to review the batch scope.',
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
            title: isRoot ? 'Root workspace' : selected.name,
            subtitle: isRoot
                ? 'Use this workspace view to review batch scope before opening sync actions.'
                : 'Use this folder view to review local scope before import or publish.',
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
        subtitle: 'A single test case is selected for editing.',
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
    color: '#738198',
}

const syncBackdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: 'none',
    background: 'rgba(15, 23, 42, 0.08)',
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
    border: '1px solid #e1e8f1',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.98)',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
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
    border: '1px solid #d7dfeb',
    background: '#fff',
    color: '#41556f',
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
    border: '1px solid #e5ebf2',
    borderRadius: 14,
    background: '#fff',
}

const syncActionGroupTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: '#68788f',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
}

const syncPrimaryButtonStyle: React.CSSProperties = {
    border: '1px solid #c8d9ff',
    background: '#f4f8ff',
    color: '#2b5ca8',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
}

const syncDangerButtonStyle: React.CSSProperties = {
    border: '1px solid #ebcec8',
    background: '#fff6f3',
    color: '#934130',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}

const syncSecondaryButtonStyle: React.CSSProperties = {
    border: '1px solid #d6deea',
    background: '#fff',
    color: '#31475f',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}

createRoot(document.getElementById('root')!).render(<App />)
