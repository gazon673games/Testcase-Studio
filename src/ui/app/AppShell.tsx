import React from 'react'
import type { IncludedCaseResolution } from '@app/workspace'
import { getSelectedNode, getSelectedFolder, getTestById } from '@app/workspace'
import { Toolbar } from '../toolbar'
import { useToast } from '../uiKit'
import { useUiPreferences } from '../preferences'
import { useStoredToggle } from './hooks/useStoredToggle'
import { useAppState } from '../state/useAppState'
import { createAppServices } from '../services'
import { AppShellModals } from './components/AppShellModals'
import { AppShellRightPane } from './components/AppShellRightPane'
import { AppShellStatus } from './components/AppShellStatus'
import { SyncCenterHost } from './components/SyncCenterHost'
import { WorkspacePane } from './components/WorkspacePane'
import { useAppShellActions } from './hooks/useAppShellActions'
import { useAppShellDialogs } from './hooks/useAppShellDialogs'
import { useAppShellEffects } from './hooks/useAppShellEffects'
import { useStartupUpdateCheck } from './hooks/useStartupUpdateCheck'
import { buildAppShellViewState } from './model/appShellViewState'
import './appShell.css'
import type { TestEditorHandle } from '../testEditor/TestEditor'

export function AppShell() {
    const { t } = useUiPreferences()
    const services = React.useMemo(() => createAppServices(t), [t])
    const app = useAppState(services)
    const editorRef = React.useRef<TestEditorHandle | null>(null)
    const { push } = useToast()
    const [previewAll, setPreviewAll] = useStoredToggle('test-editor.preview-all', false)
    const [compactWorkspace, setCompactWorkspace] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 980 : false
    )
    const dialogs = useAppShellDialogs()
    const { startupUpdate, dismissStartupUpdate } = useStartupUpdateCheck()

    const {
        handleSave,
        handleExport,
        handleApplyImport,
        handleApplyPublish,
        handlePull,
        handlePush,
        handleQuickSync,
        selectWithCommit,
    } = useAppShellActions({
        app,
        editorRef,
        push,
        t,
        closeSyncCenter: () => dialogs.setSyncCenterOpen(false),
        openIncludedCasesResolution: dialogs.openIncludedCasesResolution,
        openCreateFromScratch: dialogs.setCreateFromScratchPreview,
    })

    const handleApplyIncludedCases = React.useCallback((decisions: Record<string, IncludedCaseResolution>) => {
        void (async () => {
            const result = await app.resolveIncludedCases(decisions)
            if (result) await app.save()
            dialogs.closeIncludedCasesResolution()
        })()
    }, [app, dialogs])

    useAppShellEffects({
        onSave: handleSave,
        setCompactWorkspace,
    })

    const shellViewState = buildAppShellViewState(app, t, services.defaults.rootLabel)

    const confirmDelete = React.useCallback((targetId?: string | null) => {
        const currentState = app.state
        if (!currentState) return false
        const id = typeof targetId === 'string' && targetId ? targetId : app.selectedId
        const node = getSelectedNode(currentState, id)
        if (!node || node.id === currentState.root.id) return false
        const kindLabel = getTestById(currentState, id) ? t('confirm.deleteCaseKind') : t('confirm.deleteFolderKind')
        return window.confirm(t('confirm.deleteNode', { kind: kindLabel, name: node.name || t('tree.untitled') }))
    }, [app.selectedId, app.state, t])

    const handleDeleteSelection = React.useCallback(() => {
        if (!confirmDelete()) return
        void app.removeSelected()
    }, [app, confirmDelete])

    const handleDeleteNodeById = React.useCallback((id: string) => {
        if (!confirmDelete(id)) return
        void app.deleteNodeById(id)
    }, [app, confirmDelete])

    if (app.loadError) {
        return (
            <AppShellStatus
                title={t('app.loadFailed')}
                message={app.loadError}
                actionLabel={t('app.reload')}
                onAction={() => window.location.reload()}
            />
        )
    }

    if (!app.state) {
        return <AppShellStatus title={t('app.loading')} />
    }

    if (!shellViewState) return null

    const {
        selectedTest,
        allTests,
        importDestination,
        publishSelection,
        selectionSummary,
        canDelete,
        canExport,
        canPull,
        canPush,
        canPublish,
        canSyncAll,
    } = shellViewState
    const selectedFolder = getSelectedFolder(app.state, app.selectedId)

    const rightPane = (
        <AppShellRightPane
            editorRef={editorRef}
            selectedTest={selectedTest}
            selectedFolder={selectedFolder}
            allTests={allTests}
            sharedSteps={app.state.sharedSteps}
            focusStepId={app.focusStepId}
            previewMode={previewAll ? 'preview' : 'raw'}
            selectionSummary={selectionSummary}
            importDestination={importDestination}
            publishSelection={publishSelection}
            loadingEditorLabel={t('app.loadingEditor')}
            onUpdateTest={app.updateTest}
            onAddSharedStep={app.addSharedStep}
            onAddSharedStepFromStep={app.addSharedStepFromStep}
            onUpdateSharedStep={app.updateSharedStep}
            onDeleteSharedStep={app.deleteSharedStep}
            onInsertSharedReference={app.insertSharedReference}
            onOpenStep={app.openStep}
            onOpenTest={app.select}
            onOpenImport={() => dialogs.setImportOpen(true)}
            onOpenPublish={() => dialogs.setPublishOpen(true)}
            onAddFolder={app.addFolder}
            onAddTest={app.addTest}
            onRenameFolder={(folderId, value) => void app.renameNode(folderId, value)}
            onSetFolderAlias={(folderId, value) => void app.setNodeAlias(folderId, value)}
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
                selectionKind={selectedTest ? 'case' : 'folder'}
                onAddFolder={app.addFolder}
                onAddTest={app.addTest}
                onDelete={handleDeleteSelection}
                onSave={() => void handleSave()}
                onPull={selectedTest ? () => void handlePull() : undefined}
                onPush={selectedTest ? () => void handlePush() : undefined}
                onExport={() => void handleExport()}
                onOpenSettings={() => dialogs.setSettingsOpen(true)}
                onToggleSyncCenter={() => dialogs.setSyncCenterOpen((current) => !current)}
                onTogglePreviewMode={selectedTest ? () => setPreviewAll((current) => !current) : undefined}
                syncCenterOpen={dialogs.syncCenterOpen}
                canDelete={canDelete}
                canExport={canExport}
                canPull={canPull}
                canPush={canPush}
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
                onDelete={handleDeleteNodeById}
                onSetNodeAlias={app.setNodeAlias}
                onSetNodeIcon={app.setNodeIcon}
                onOpenStep={app.openStep}
                rightPane={rightPane}
                syncCenter={
                    <SyncCenterHost
                        open={dialogs.syncCenterOpen}
                        selectionLabel={selectionSummary.pathLabel}
                        importDestinationLabel={importDestination.label}
                        publishSelectionLabel={publishSelection.label}
                        publishCount={publishSelection.tests.length}
                        canPull={canPull}
                        canPublish={canPublish}
                        canSyncAll={canSyncAll}
                        onClose={() => dialogs.setSyncCenterOpen(false)}
                        onOpenImport={() => dialogs.setImportOpen(true)}
                        onOpenPublish={() => dialogs.setPublishOpen(true)}
                        onPull={() => void handlePull()}
                        onSyncAll={() => void handleQuickSync()}
                    />
                }
            />

            <AppShellModals
                settingsOpen={dialogs.settingsOpen}
                importOpen={dialogs.importOpen}
                publishOpen={dialogs.publishOpen}
                createFromScratchPreview={dialogs.createFromScratchPreview}
                includedCasesOpen={dialogs.includedCasesOpen}
                includedCasesItems={dialogs.includedCasesItems}
                importDestinationLabel={importDestination.label}
                publishSelectionLabel={publishSelection.label}
                startupUpdate={startupUpdate}
                onCloseSettings={() => dialogs.setSettingsOpen(false)}
                onCloseImport={() => dialogs.setImportOpen(false)}
                onClosePublish={() => dialogs.setPublishOpen(false)}
                onCloseCreateFromScratch={() => dialogs.setCreateFromScratchPreview(null)}
                onCloseIncludedCases={dialogs.closeIncludedCasesResolution}
                onDismissStartupUpdate={dismissStartupUpdate}
                onPreviewImport={(request) => app.previewZephyrImport(request)}
                onApplyImport={handleApplyImport}
                onPreviewPublish={() => app.previewZephyrPublish()}
                onApplyPublish={handleApplyPublish}
                onApplyCreateFromScratch={handleApplyPublish}
                onApplyIncludedCases={handleApplyIncludedCases}
            />
        </div>
    )
}
