import * as React from 'react'
import {
    addFolderAt as addFolderAtCommand,
    addFolderFromSelection,
    addSharedStep as addSharedStepCommand,
    addSharedStepFromStep as addSharedStepFromStepCommand,
    addTestAt as addTestAtCommand,
    addTestFromSelection,
    deleteNodeById as deleteNodeByIdCommand,
    deleteSharedStep as deleteSharedStepCommand,
    applyZephyrImport as applyZephyrImportUseCase,
    getImportDestination as getImportDestinationQuery,
    getPublishSelection as getPublishSelectionQuery,
    getSelectedNode,
    insertSharedReference as insertSharedReferenceCommand,
    loadWorkspaceState,
    moveWorkspaceNode,
    previewZephyrImport as previewZephyrImportUseCase,
    previewZephyrPublish as previewZephyrPublishUseCase,
    publishZephyrPreview as publishZephyrPreviewUseCase,
    pullSelectedCase,
    removeSelectedNode,
    renameWorkspaceNode,
    saveWorkspace as saveWorkspaceUseCase,
    updateSharedStep as updateSharedStepCommand,
    updateTestCase,
} from '@app/workspace'
import { type ZephyrImportPreview, type ZephyrImportRequest, type ZephyrPublishPreview, type ZephyrPublishResult } from '@app/sync'
import { type Folder, type ID, type RootState, type SharedStep, type Step, type TestCase } from '@core/domain'
import { isFolder, mapTests } from '@core/tree'
import type { AppServices } from './appServices'

type Node = Folder | TestCase
type SyncAllResult = { status: 'ok'; count: number }
type SaveState = 'saved' | 'pending' | 'saving' | 'error'

const AUTOSAVE_DELAY_MS = 700

export function useAppState(services: AppServices) {
    const [state, setState] = React.useState<RootState | null>(null)
    const [selectedId, setSelectedId] = React.useState<ID | null>(null)
    const [focusStepId, setFocusStepId] = React.useState<string | null>(null)
    const [dirtyTestIds, setDirtyTestIds] = React.useState<Set<string>>(() => new Set())
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)

    const latestStateRef = React.useRef<RootState | null>(null)
    const latestRevisionRef = React.useRef(0)
    const saveTimerRef = React.useRef<number | null>(null)
    const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
    const activeSavesRef = React.useRef(0)

    const sync = services.sync

    React.useEffect(() => {
        loadWorkspaceState().then((nextState) => {
            latestStateRef.current = nextState
            latestRevisionRef.current = 0
            setState(nextState)
            setSelectedId(nextState.root.id)
            setHasUnsavedChanges(false)
            setSaveError(null)
        })
    }, [])

    const cancelScheduledSave = React.useCallback(() => {
        if (saveTimerRef.current == null) return
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
    }, [])

    React.useEffect(() => () => cancelScheduledSave(), [cancelScheduledSave])

    function markDirty(testIds?: string[]) {
        if (!testIds?.length) return
        const ids = testIds.map((id) => String(id || '').trim()).filter(Boolean)
        if (!ids.length) return
        setDirtyTestIds((current) => {
            const next = new Set(current)
            ids.forEach((id) => next.add(id))
            return next
        })
    }

    function clearDirty(testIds?: string[]) {
        if (!testIds || !testIds.length) {
            setDirtyTestIds(new Set())
            return
        }
        const ids = testIds.map((id) => String(id || '').trim()).filter(Boolean)
        if (!ids.length) return
        setDirtyTestIds((current) => {
            const next = new Set(current)
            ids.forEach((id) => next.delete(id))
            return next
        })
    }

    function getCurrentState() {
        return latestStateRef.current ?? state
    }

    const runQueuedSave = React.useCallback(
        async (snapshot: RootState, revision: number) => {
            activeSavesRef.current += 1
            setIsSaving(true)
            setSaveError(null)
            try {
                const saved = await saveWorkspaceUseCase(snapshot)
                if (!saved) return false
                if (latestRevisionRef.current === revision) {
                    setHasUnsavedChanges(false)
                    clearDirty()
                }
                return true
            } catch (error) {
                if (latestRevisionRef.current === revision) {
                    setHasUnsavedChanges(true)
                    setSaveError(error instanceof Error ? error.message : String(error))
                }
                throw error
            } finally {
                activeSavesRef.current -= 1
                if (activeSavesRef.current === 0) setIsSaving(false)
            }
        },
        []
    )

    const enqueueSave = React.useCallback(
        (snapshot: RootState, revision: number) => {
            const job = saveQueueRef.current
                .catch(() => undefined)
                .then(async () => {
                    await runQueuedSave(snapshot, revision)
                })
            saveQueueRef.current = job.catch(() => undefined)
            return job
        },
        [runQueuedSave]
    )

    const scheduleSave = React.useCallback(() => {
        cancelScheduledSave()
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null
            const snapshot = latestStateRef.current
            if (!snapshot) return
            void enqueueSave(snapshot, latestRevisionRef.current).catch(() => undefined)
        }, AUTOSAVE_DELAY_MS)
    }, [cancelScheduledSave, enqueueSave])

    const stageLocalState = React.useCallback(
        (next: RootState, dirtyIds?: string[]) => {
            const snapshot = structuredClone(next)
            latestStateRef.current = snapshot
            latestRevisionRef.current += 1
            setState(snapshot)
            markDirty(dirtyIds)
            setHasUnsavedChanges(true)
            setSaveError(null)
            scheduleSave()
        },
        [scheduleSave]
    )

    const persistStateNow = React.useCallback(
        async (next: RootState, dirtyIds?: string[]) => {
            const snapshot = structuredClone(next)
            latestStateRef.current = snapshot
            latestRevisionRef.current += 1
            const revision = latestRevisionRef.current
            setState(snapshot)
            markDirty(dirtyIds)
            setHasUnsavedChanges(true)
            setSaveError(null)
            cancelScheduledSave()
            await enqueueSave(snapshot, revision)
        },
        [cancelScheduledSave, enqueueSave]
    )

    const flushSave = React.useCallback(async () => {
        const snapshot = latestStateRef.current
        if (!snapshot) return false

        const hasScheduledSave = saveTimerRef.current != null
        if (!hasUnsavedChanges && !hasScheduledSave && !saveError) {
            await saveQueueRef.current
            return true
        }

        cancelScheduledSave()
        await enqueueSave(snapshot, latestRevisionRef.current)
        return true
    }, [cancelScheduledSave, enqueueSave, hasUnsavedChanges, saveError])

    function getSelected(): Node | null {
        return getSelectedNode(getCurrentState(), selectedId)
    }

    function select(id: ID) {
        setSelectedId(id)
        setFocusStepId(null)
    }

    function getImportDestination() {
        return getImportDestinationQuery(getCurrentState(), selectedId, services.defaults.rootLabel)
    }

    function getPublishSelection() {
        return getPublishSelectionQuery(getCurrentState(), selectedId, services.defaults.rootLabel)
    }

    async function addFolderAt(parentId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addFolderAtCommand(currentState, parentId, services.defaults.newFolder)
        stageLocalState(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTestAt(parentId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addTestAtCommand(currentState, parentId, services.defaults.newCase, services.defaults.firstStep)
        stageLocalState(result.nextState, result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function addFolder() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addFolderFromSelection(currentState, selectedId, services.defaults.newFolder)
        stageLocalState(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTest() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addTestFromSelection(currentState, selectedId, services.defaults.newCase, services.defaults.firstStep)
        stageLocalState(result.nextState, result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function removeSelected() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = removeSelectedNode(currentState, selectedId)
        if (!result) return
        stageLocalState(result.nextState)
        if (result.selectedId !== undefined) setSelectedId(result.selectedId)
        if (result.focusStepId !== undefined) setFocusStepId(result.focusStepId)
    }

    async function renameNode(id: ID, newName: string) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = renameWorkspaceNode(currentState, id, newName)
        if (!result) return
        stageLocalState(result.nextState, result.dirtyIds)
    }

    async function deleteNodeById(id: ID) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = deleteNodeByIdCommand(currentState, id, selectedId)
        if (!result) return
        stageLocalState(result.nextState)
        if (result.selectedId !== undefined) setSelectedId(result.selectedId)
        if (result.focusStepId !== undefined) setFocusStepId(result.focusStepId)
    }

    async function moveNode(nodeId: ID, targetFolderId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return false
        const result = moveWorkspaceNode(currentState, nodeId, targetFolderId)
        if (result.moved) {
            stageLocalState(result.nextState)
            if (result.selectedId) setSelectedId(result.selectedId)
        }
        return result.moved
    }

    async function save() {
        return flushSave()
    }

    async function updateTest(
        testId: ID,
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = updateTestCase(currentState, testId, patch)
        if (!result) return
        stageLocalState(result.nextState, result.dirtyIds)
    }

    async function addSharedStep(name = services.defaults.sharedStep, steps: Step[] = []) {
        const currentState = getCurrentState()
        if (!currentState) return null
        const result = addSharedStepCommand(currentState, name, steps)
        stageLocalState(result.nextState)
        return result.sharedId
    }

    async function addSharedStepFromStep(step: Step, name?: string) {
        const currentState = getCurrentState()
        if (!currentState) return null
        const result = addSharedStepFromStepCommand(currentState, step, services.defaults.sharedStep, name)
        stageLocalState(result.nextState)
        return result.sharedId
    }

    async function updateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = updateSharedStepCommand(currentState, sharedId, patch)
        if (!result) return
        stageLocalState(result.nextState)
    }

    async function deleteSharedStep(sharedId: string) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = deleteSharedStepCommand(currentState, sharedId)
        stageLocalState(result.nextState, result.dirtyIds)
    }

    async function insertSharedReference(testId: string, sharedId: string, afterIndex?: number) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = insertSharedReferenceCommand(currentState, testId, sharedId, afterIndex)
        if (!result) return
        stageLocalState(result.nextState, result.dirtyIds)
    }

    async function pull() {
        const result = await pullSelectedCase(getCurrentState(), selectedId, sync)
        if (result.status !== 'ok') return result
        await persistStateNow(result.nextState)
        return {
            status: result.status,
            testId: result.testId,
            externalId: result.externalId,
        }
    }

    async function push() {
        const currentState = getCurrentState()
        if (!currentState) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return
        await sync.pushTest(node, node.links[0], currentState)
    }

    async function syncAll(): Promise<SyncAllResult> {
        const currentState = getCurrentState()
        if (!currentState) return { status: 'ok', count: 0 }
        const next = structuredClone(currentState)
        const tests = mapTests(next.root)
        await sync.twoWaySync(next)
        await persistStateNow(next)
        clearDirty(tests.map((test) => test.id))
        return { status: 'ok', count: tests.length }
    }

    async function previewZephyrImport(
        request: Omit<ZephyrImportRequest, 'destinationFolderId'> & { destinationFolderId?: string }
    ): Promise<ZephyrImportPreview> {
        return previewZephyrImportUseCase(getCurrentState(), selectedId, sync, services.defaults.rootLabel, request)
    }

    async function applyZephyrImportPreview(preview: ZephyrImportPreview) {
        const { nextState, result, clearedDirtyIds } = await applyZephyrImportUseCase(getCurrentState(), preview, sync)
        await persistStateNow(nextState)
        clearDirty(clearedDirtyIds)
        return result
    }

    async function previewZephyrPublish(): Promise<ZephyrPublishPreview> {
        return previewZephyrPublishUseCase(getCurrentState(), selectedId, sync, services.defaults.rootLabel)
    }

    async function publishZephyr(preview: ZephyrPublishPreview): Promise<ZephyrPublishResult & { snapshotPath: string; logPath: string }> {
        cancelScheduledSave()
        await saveQueueRef.current

        const outcome = await publishZephyrPreviewUseCase(getCurrentState(), preview, sync)
        const snapshot = structuredClone(outcome.nextState)
        latestStateRef.current = snapshot
        latestRevisionRef.current += 1
        setState(snapshot)
        clearDirty(outcome.clearedDirtyIds)
        setHasUnsavedChanges(false)
        setSaveError(null)

        return {
            ...outcome.result,
            snapshotPath: outcome.snapshotPath,
            logPath: outcome.logPath,
        }
    }

    function openStep(testId: string, stepId: string) {
        setSelectedId(testId)
        setFocusStepId(stepId)
    }

    const saveState: SaveState = saveError
        ? 'error'
        : isSaving
            ? 'saving'
            : hasUnsavedChanges
                ? 'pending'
                : 'saved'

    return {
        state,
        selectedId,
        dirtyTestIds,
        saveState,
        saveError,
        hasUnsavedChanges,
        select,
        addFolder,
        addTest,
        removeSelected,
        save,
        updateTest,
        addSharedStep,
        addSharedStepFromStep,
        updateSharedStep,
        deleteSharedStep,
        insertSharedReference,
        pull,
        push,
        syncAll,
        getImportDestination,
        getPublishSelection,
        previewZephyrImport,
        applyZephyrImport: applyZephyrImportPreview,
        previewZephyrPublish,
        publishZephyr,
        addFolderAt,
        addTestAt,
        renameNode,
        deleteNodeById,
        moveNode,
        openStep,
        focusStepId,
        mapAllTests: () => (getCurrentState() ? mapTests(getCurrentState()!.root) : []),
    }
}
