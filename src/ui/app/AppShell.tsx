import React from 'react'
import type { ZephyrImportPreview, ZephyrPublishPreview } from '@app/sync'
import { buildExport } from '@core/export'
import { findNode, isFolder } from '@core/tree'
import { SettingsModal } from '../Settings'
import { Toolbar } from '../Toolbar'
import { UiKit, useToast } from '../UiKit'
import { UiPreferencesProvider, useUiPreferences } from '../preferences'
import { useStoredToggle } from '../useStoredToggle'
import { useAppState } from '../useAppState'
import { createAppServices } from '../appServices'
import { ZephyrImportModal } from '../ZephyrImportModal'
import { ZephyrPublishModal } from '../ZephyrPublishModal'
import { ScopeOverviewPanel } from './ScopeOverviewPanel'
import { buildSelectionSummary } from './selectionSummary'
import { SyncCenterHost } from './SyncCenterHost'
import { WorkspacePane } from './WorkspacePane'
import './appShell.css'

const TestEditor = React.lazy(() =>
    import('../testEditor/TestEditor').then((module) => ({ default: module.TestEditor }))
)
import type { TestEditorHandle } from '../testEditor/TestEditor'

export function AppShell() {
    const { t } = useUiPreferences()
    const services = React.useMemo(() => createAppServices(t), [t])
    const app = useAppState(services)
    const editorRef = React.useRef<TestEditorHandle | null>(null)
    const { push } = useToast()
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
        const shouldAnnounceSave = app.saveState !== 'saved'
        try {
            const saved = await app.save()
            if (saved && shouldAnnounceSave) {
                push({ kind: 'success', text: t('toast.changesSaved'), ttl: 2200 })
            }
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.saveFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 3500,
            })
        }
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
                text: t('toast.importApplied', {
                    created: result.created,
                    updated: result.updated,
                    skipped: result.skipped,
                    drafts: result.drafts,
                    unchanged: result.unchanged,
                }),
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
                text: t('toast.publishFinished', {
                    created: result.created,
                    updated: result.updated,
                    skipped: result.skipped,
                    failed: result.failed,
                    blocked: result.blocked,
                }),
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
            <div className="app-shell__loading">
                <h1>{t('app.loading')}</h1>
            </div>
        )
    }

    const selected = app.selectedId ? findNode(app.state.root, app.selectedId) : null
    const selectedTest = selected && !isFolder(selected) ? selected : null
    const allTests = app.mapAllTests()
    const importDestination = app.getImportDestination()
    const publishSelection = app.getPublishSelection()
    const selectionSummary = buildSelectionSummary(app.state.root, selected, t, services.defaults.rootLabel)

    const canDelete = !!selected && selected.id !== app.state.root.id
    const canExport = !!selectedTest
    const canPull = !!selectedTest
    const canPublish = publishSelection.tests.length > 0
    const canSyncAll = allTests.some((test) => (test.links?.length ?? 0) > 0)

    const rightPane = selectedTest ? (
        <React.Suspense fallback={<div className="app-shell__editor-loading">{t('app.loadingEditor')}</div>}>
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
            onOpenImport={() => setImportOpen(true)}
            onOpenPublish={() => setPublishOpen(true)}
            onAddFolder={app.addFolder}
            onAddTest={app.addTest}
        />
    )

    return (
        <div className="app-shell">
            <Toolbar
                selectionLabel={selectionSummary.pathLabel}
                importDestinationLabel={importDestination.label}
                publishSelectionLabel={publishSelection.label}
                publishCount={publishSelection.tests.length}
                saveState={app.saveState}
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

            <WorkspacePane
                compactWorkspace={compactWorkspace}
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
                rightPane={rightPane}
                syncCenter={
                    <SyncCenterHost
                        open={syncCenterOpen}
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
                        onPull={() => void handlePull()}
                        onSyncAll={() => void handleQuickSync()}
                    />
                }
            />

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

export function App() {
    return (
        <UiPreferencesProvider>
            <UiKit>
                <AppShell />
            </UiKit>
        </UiPreferencesProvider>
    )
}
