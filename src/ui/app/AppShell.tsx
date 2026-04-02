import React from 'react'
import type { ZephyrImportPreview, ZephyrPublishPreview } from '@app/sync'
import { SettingsModal } from '../settings'
import { Toolbar } from '../toolbar'
import { useToast } from '../uiKit'
import { useUiPreferences } from '../preferences'
import { useStoredToggle } from '../hooks/useStoredToggle'
import { useAppState } from '../state/useAppState'
import { createAppServices } from '../services'
import { ZephyrImportModal } from '../zephyrImport/ZephyrImportModal'
import { ZephyrPublishModal } from '../zephyrPublish'
import { AppShellRightPane } from './components/AppShellRightPane'
import { AppShellStatus } from './components/AppShellStatus'
import { SyncCenterHost } from './components/SyncCenterHost'
import { WorkspacePane } from './components/WorkspacePane'
import { useAppShellActions } from './hooks/useAppShellActions'
import { useAppShellEffects } from './hooks/useAppShellEffects'
import { buildAppShellViewState } from './model/appShellViewState'
import './appShell.css'
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

    const {
        handleSave,
        handleExport,
        handleApplyImport,
        handleApplyPublish,
        handlePull,
        handleQuickSync,
        selectWithCommit,
    } = useAppShellActions({
        app,
        editorRef,
        push,
        t,
        closeSyncCenter: () => setSyncCenterOpen(false),
    })

    useAppShellEffects({
        onSave: handleSave,
        setCompactWorkspace,
    })

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

    const shellViewState = buildAppShellViewState(app, t, services.defaults.rootLabel)
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
        canPublish,
        canSyncAll,
    } = shellViewState

    const rightPane = (
        <AppShellRightPane
            editorRef={editorRef}
            selectedTest={selectedTest}
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
