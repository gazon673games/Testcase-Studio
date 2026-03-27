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

    const handleExport = React.useCallback(async () => {
        editorRef.current?.commit?.()

        if (!app.state || !app.selectedId) {
            push({ kind: 'error', text: 'Select a test before export', ttl: 2500 })
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

        push({ kind: 'success', text: 'Test exported to JSON', ttl: 2500 })
    }, [app, push])

    const handleApplyImport = React.useCallback(
        async (preview: ZephyrImportPreview) => {
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
            sharedStepsCount={app.state.sharedSteps.length}
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
                onImport={() => setImportOpen(true)}
                onPull={() => void app.pull()}
                onPublish={() => setPublishOpen(true)}
                onSyncAll={() => void app.syncAll()}
                onExport={() => void handleExport()}
                onOpenSettings={() => setSettingsOpen(true)}
                canDelete={canDelete}
                canPull={canPull}
                canPublish={canPublish}
                canSyncAll={canSyncAll}
                canExport={canExport}
            />

            {selectionSummary.kind !== 'test' && (
                <ScopeStrip
                    selectionLabel={selectionSummary.pathLabel}
                    selectionKind={selectionSummary.kind}
                    importDestinationLabel={importDestination.label}
                    publishSelectionLabel={publishSelection.label}
                    publishCount={publishSelection.tests.length}
                />
            )}

            <div
                style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    minHeight: 0,
                }}
            >
                <div style={{ borderRight: '1px solid #eee', overflow: 'auto' }}>
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
                <div style={{ overflow: 'auto', background: '#fbfcfe' }}>{rightPane}</div>
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

function ScopeStrip({
    selectionLabel,
    selectionKind,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
}: {
    selectionLabel: string
    selectionKind: SelectionSummary['kind']
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
}) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
                padding: '10px 12px',
                borderBottom: '1px solid #edf1f6',
                background: '#fcfdff',
            }}
        >
            <ScopeCard
                label="Selected"
                value={selectionLabel}
                hint={selectionKind === 'test' ? 'Editing one testcase' : 'Current workspace scope'}
                tone="neutral"
            />
            <ScopeCard
                label="Import destination"
                value={importDestinationLabel}
                hint="Zephyr import writes into this local folder"
                tone="info"
            />
            <ScopeCard
                label="Publish scope"
                value={publishSelectionLabel}
                hint={
                    publishCount === 0
                        ? 'Nothing will be published from this scope yet'
                        : publishCount === 1
                            ? 'One testcase will be compared'
                            : `${publishCount} tests will be compared`
                }
                tone={publishCount === 0 ? 'neutral' : publishCount > 1 ? 'warn' : 'danger'}
            />
        </div>
    )
}

function ScopeCard({
    label,
    value,
    hint,
    tone,
}: {
    label: string
    value: string
    hint: string
    tone: 'neutral' | 'info' | 'warn' | 'danger'
}) {
    const accents =
        tone === 'info'
            ? { border: '#cfe0ff', background: '#f4f8ff', label: '#2d5fa9' }
            : tone === 'warn'
                ? { border: '#edd9b2', background: '#fffaf0', label: '#8b6408' }
                : tone === 'danger'
                    ? { border: '#e8c7c0', background: '#fff6f3', label: '#944332' }
                    : { border: '#e5eaf1', background: '#ffffff', label: '#5c6b80' }

    return (
        <div
            style={{
                minWidth: 0,
                border: `1px solid ${accents.border}`,
                background: accents.background,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'grid',
                gap: 4,
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    color: accents.label,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#22384f',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {value}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: '#6d7b90' }}>{hint}</div>
        </div>
    )
}

function ScopeOverviewPanel({
    summary,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    sharedStepsCount,
    onOpenImport,
    onOpenPublish,
    onAddFolder,
    onAddTest,
}: {
    summary: SelectionSummary
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    sharedStepsCount: number
    onOpenImport(): void
    onOpenPublish(): void
    onAddFolder(): void
    onAddTest(): void
}) {
    return (
        <div
            style={{
                padding: 24,
                display: 'grid',
                gap: 18,
                maxWidth: 980,
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gap: 8,
                    padding: 22,
                    borderRadius: 22,
                    border: '1px solid #e3e8f0',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)',
                }}
            >
                <div style={eyebrowStyle}>
                    {summary.kind === 'root' ? 'Workspace overview' : summary.kind === 'folder' ? 'Folder overview' : 'Selection overview'}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#20354f' }}>{summary.title}</div>
                <div style={{ color: '#5f6e84', fontSize: 14, lineHeight: 1.55 }}>{summary.subtitle}</div>
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
                <OverviewStat label="Tests in scope" value={String(summary.testCount)} hint="Will participate in batch publish" />
                <OverviewStat label="Direct children" value={String(summary.directChildrenCount)} hint="Immediate items in current node" />
                <OverviewStat label="Shared steps" value={String(sharedStepsCount)} hint="Reusable library entries" />
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
                    description="Preview-first import will create or replace local tests inside this destination."
                    tone="info"
                    actionLabel="Open import..."
                    onAction={onOpenImport}
                />
                <ActionCard
                    label="Publish to Zephyr"
                    title={publishSelectionLabel}
                    description={
                        publishCount === 0
                            ? 'There are no testcases in the current publish scope yet.'
                            : publishCount === 1
                            ? 'One testcase is currently in publish scope.'
                            : `${publishCount} tests are currently in publish scope.`
                    }
                    tone={publishCount === 0 ? 'neutral' : publishCount > 1 ? 'warn' : 'danger'}
                    actionLabel="Open publish..."
                    onAction={publishCount > 0 ? onOpenPublish : undefined}
                />
                <ActionCard
                    label="Local editing"
                    title="Create content"
                    description="Use the current folder as the destination for new tests and nested folders."
                    tone="neutral"
                    extra={(
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <QuickActionButton onClick={onAddFolder}>New Folder</QuickActionButton>
                            <QuickActionButton onClick={onAddTest}>New Test</QuickActionButton>
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
                borderRadius: 16,
                background: '#fff',
                padding: '16px 18px',
                display: 'grid',
                gap: 6,
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
                borderRadius: 18,
                background: accents.background,
                padding: 18,
                display: 'grid',
                gap: 10,
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
                padding: '9px 12px',
                fontWeight: 700,
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    )
}

function buildSelectionSummary(root: Folder, selected: Folder | TestCase | null): SelectionSummary {
    if (!selected) {
        return {
            kind: 'none',
            title: 'Nothing selected',
            subtitle: 'Select a test to edit it or pick a folder to review the batch scope.',
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
                ? 'This screen now exposes the real local batch scope for import and publish.'
                : 'Batch actions use this folder as the visible local scope and destination.',
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
        subtitle: 'A single testcase is selected for editing.',
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

createRoot(document.getElementById('root')!).render(<App />)
