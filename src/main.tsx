import React from 'react'
import { createRoot } from 'react-dom/client'
import { useAppState } from './ui/useAppState'
import { Tree } from './ui/Tree'
import { Toolbar } from './ui/Toolbar'
import { SettingsModal } from './ui/Settings'
import { UiKit, useToast } from './ui/UiKit'
import { ZephyrImportModal } from './ui/ZephyrImportModal'
import { ZephyrPublishModal } from './ui/ZephyrPublishModal'
import { isFolder, findNode } from '@core/tree'
import { buildExport } from '@core/export'
import type { ZephyrImportPreview } from '@core/zephyrImport'
import type { ZephyrPublishPreview } from '@core/zephyrPublish'

const TestEditor = React.lazy(() =>
    import('./ui/testEditor/TestEditor').then((module) => ({ default: module.TestEditor }))
)
import type { TestEditorHandle } from './ui/testEditor/TestEditor'

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
                <h1>Loading…</h1>
            </div>
        )
    }

    const selected = app.selectedId ? findNode(app.state.root, app.selectedId) : null
    const allTests = app.mapAllTests()
    const importDestination = app.getImportDestination()
    const publishSelection = app.getPublishSelection()

    const rightPane =
        !selected || isFolder(selected as any) ? (
            <EmptyPanel />
        ) : (
            <React.Suspense fallback={<div style={{ padding: 16 }}>Loading editor…</div>}>
                <TestEditor
                    ref={editorRef}
                    test={selected as any}
                    onChange={(patch: any) => app.updateTest((selected as any).id, patch)}
                    focusStepId={app.focusStepId}
                    allTests={allTests}
                    sharedSteps={app.state.sharedSteps}
                    onAddSharedStep={app.addSharedStep}
                    onAddSharedStepFromStep={app.addSharedStepFromStep}
                    onUpdateSharedStep={app.updateSharedStep}
                    onDeleteSharedStep={app.deleteSharedStep}
                    onInsertSharedReference={(sharedId: string) => app.insertSharedReference((selected as any).id, sharedId)}
                    onOpenStep={app.openStep}
                    onOpenTest={app.select}
                />
            </React.Suspense>
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
            />

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
                <div style={{ overflow: 'auto' }}>{rightPane}</div>
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

function EmptyPanel() {
    return <div style={{ padding: 16, color: '#666' }}>Select a test in the tree to edit it.</div>
}

createRoot(document.getElementById('root')!).render(<App />)
