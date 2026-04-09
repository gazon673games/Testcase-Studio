import React from 'react'
import type { IncludedCaseCandidate, IncludedCaseResolution } from '@app/workspace'
import type { ZephyrImportPreview, ZephyrPublishPreview } from '@app/sync'
import type { AppUpdateCheckResult } from '@shared/appUpdates'
import { findNode, isFolder } from '@core/tree'
import { apiClient } from '@ipc/client'
import { SettingsModal } from '../settings'
import { Toolbar } from '../toolbar'
import { useToast } from '../uiKit'
import { useUiPreferences } from '../preferences'
import { useStoredToggle } from '../hooks/useStoredToggle'
import { useAppState } from '../state/useAppState'
import { createAppServices } from '../services'
import { ZephyrImportModal } from '../zephyrImport/ZephyrImportModal'
import { ZephyrPublishModal } from '../zephyrPublish'
import { ZephyrCreateFromScratchModal } from '../zephyrPublish/ZephyrCreateFromScratchModal'
import { IncludedCaseResolutionModal } from '../includedCases/IncludedCaseResolutionModal'
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
    const [createFromScratchPreview, setCreateFromScratchPreview] = React.useState<ZephyrPublishPreview | null>(null)
    const [syncCenterOpen, setSyncCenterOpen] = React.useState(false)
    const [includedCasesOpen, setIncludedCasesOpen] = React.useState(false)
    const [includedCasesItems, setIncludedCasesItems] = React.useState<IncludedCaseCandidate[]>([])
    const [startupUpdate, setStartupUpdate] = React.useState<AppUpdateCheckResult | null>(null)
    const [previewAll, setPreviewAll] = useStoredToggle('test-editor.preview-all', false)
    const [compactWorkspace, setCompactWorkspace] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 980 : false
    )
    const checkedStartupUpdateRef = React.useRef(false)

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
        closeSyncCenter: () => setSyncCenterOpen(false),
        openIncludedCasesResolution: (items) => {
            if (!items.length) return
            setIncludedCasesItems(items)
            setIncludedCasesOpen(true)
        },
        openCreateFromScratch: (preview) => setCreateFromScratchPreview(preview),
    })

    const handleApplyIncludedCases = React.useCallback((decisions: Record<string, IncludedCaseResolution>) => {
        void (async () => {
            const result = await app.resolveIncludedCases(decisions)
            if (result) await app.save()
            setIncludedCasesOpen(false)
            setIncludedCasesItems([])
        })()
    }, [app])

    useAppShellEffects({
        onSave: handleSave,
        setCompactWorkspace,
    })

    React.useEffect(() => {
        if (checkedStartupUpdateRef.current) return
        checkedStartupUpdateRef.current = true
        void apiClient.checkForUpdates()
            .then((result) => {
                if (!result.isPackaged || !result.updateAvailable) return
                setStartupUpdate(result)
            })
            .catch(() => {
                // Best-effort startup check only.
            })
    }, [])

    const shellViewState = buildAppShellViewState(app, t, services.defaults.rootLabel)

    const confirmDelete = React.useCallback((targetId?: string | null) => {
        const currentState = app.state
        if (!currentState) return false
        const id = typeof targetId === 'string' && targetId ? targetId : app.selectedId
        const node = id ? findNode(currentState.root, id) : null
        if (!node || node.id === currentState.root.id) return false
        const kindLabel = isFolder(node) ? t('confirm.deleteFolderKind') : t('confirm.deleteCaseKind')
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

    const openExternal = React.useCallback((url: string | null | undefined) => {
        const next = String(url ?? '').trim()
        if (!next) return
        window.open(next, '_blank', 'noopener')
    }, [])

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
                selectionKind={selectedTest ? 'case' : 'folder'}
                onAddFolder={app.addFolder}
                onAddTest={app.addTest}
                onDelete={handleDeleteSelection}
                onSave={() => void handleSave()}
                onPull={selectedTest ? () => void handlePull() : undefined}
                onPush={selectedTest ? () => void handlePush() : undefined}
                onExport={() => void handleExport()}
                onOpenSettings={() => setSettingsOpen(true)}
                onToggleSyncCenter={() => setSyncCenterOpen((current) => !current)}
                onTogglePreviewMode={selectedTest ? () => setPreviewAll((current) => !current) : undefined}
                syncCenterOpen={syncCenterOpen}
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
            <ZephyrCreateFromScratchModal
                open={!!createFromScratchPreview}
                preview={createFromScratchPreview}
                onClose={() => setCreateFromScratchPreview(null)}
                onCreate={async (preview) => {
                    await handleApplyPublish(preview)
                }}
            />
            <IncludedCaseResolutionModal
                open={includedCasesOpen}
                items={includedCasesItems}
                onClose={() => {
                    setIncludedCasesOpen(false)
                    setIncludedCasesItems([])
                }}
                onApply={handleApplyIncludedCases}
            />
            {startupUpdate ? (
                <div className="app-update-modal__backdrop">
                    <div className="app-update-modal" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
                        <div className="app-update-modal__header">
                            <div className="app-update-modal__title" id="app-update-title">
                                {t('app.updateAvailableTitle')}
                            </div>
                            <button
                                type="button"
                                className="app-update-modal__close"
                                onClick={() => setStartupUpdate(null)}
                                title={t('app.updateDismiss')}
                            >
                                x
                            </button>
                        </div>
                        <div className="app-update-modal__body">
                            <div className="app-update-modal__text">
                                {t('app.updateAvailableMessage', {
                                    current: startupUpdate.version,
                                    latest: startupUpdate.latestVersion ?? startupUpdate.latestTag ?? '?',
                                })}
                            </div>
                            {startupUpdate.downloadName ? (
                                <div className="app-update-modal__hint">{startupUpdate.downloadName}</div>
                            ) : null}
                            <div className="app-update-modal__actions">
                                {startupUpdate.downloadUrl ? (
                                    <button
                                        type="button"
                                        className="overview-button"
                                        onClick={() => openExternal(startupUpdate.downloadUrl)}
                                    >
                                        {t('app.updateDownload')}
                                    </button>
                                ) : null}
                                {startupUpdate.releaseUrl ? (
                                    <button
                                        type="button"
                                        className="overview-button app-update-modal__button--secondary"
                                        onClick={() => openExternal(startupUpdate.releaseUrl)}
                                    >
                                        {t('app.updateOpenRelease')}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="overview-button app-update-modal__button--secondary"
                                    onClick={() => setStartupUpdate(null)}
                                >
                                    {t('app.updateDismiss')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
