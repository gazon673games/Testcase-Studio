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

export function useAppState(services: AppServices) {
    const [state, setState] = React.useState<RootState | null>(null)
    const [selectedId, setSelectedId] = React.useState<ID | null>(null)
    const [focusStepId, setFocusStepId] = React.useState<string | null>(null)
    const [dirtyTestIds, setDirtyTestIds] = React.useState<Set<string>>(() => new Set())

    const sync = services.sync

    React.useEffect(() => {
        loadWorkspaceState().then((nextState) => {
            setState(nextState)
            setSelectedId(nextState.root.id)
        })
    }, [])

    async function persist(next: RootState) {
        setState(structuredClone(next))
        await saveWorkspaceUseCase(next)
    }

    function markDirty(testIds: string[]) {
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

    function getSelected(): Node | null {
        return getSelectedNode(state, selectedId)
    }

    function select(id: ID) {
        setSelectedId(id)
        setFocusStepId(null)
    }

    function getImportDestination() {
        return getImportDestinationQuery(state, selectedId, services.defaults.rootLabel)
    }

    function getPublishSelection() {
        return getPublishSelectionQuery(state, selectedId, services.defaults.rootLabel)
    }

    async function addFolderAt(parentId: ID) {
        if (!state) return
        const result = addFolderAtCommand(state, parentId, services.defaults.newFolder)
        await persist(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTestAt(parentId: ID) {
        if (!state) return
        const result = addTestAtCommand(state, parentId, services.defaults.newCase, services.defaults.firstStep)
        await persist(result.nextState)
        markDirty(result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function addFolder() {
        if (!state) return
        const result = addFolderFromSelection(state, selectedId, services.defaults.newFolder)
        await persist(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTest() {
        if (!state) return
        const result = addTestFromSelection(state, selectedId, services.defaults.newCase, services.defaults.firstStep)
        await persist(result.nextState)
        markDirty(result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function removeSelected() {
        if (!state) return
        const result = removeSelectedNode(state, selectedId)
        if (!result) return
        await persist(result.nextState)
        if (result.selectedId !== undefined) setSelectedId(result.selectedId)
        if (result.focusStepId !== undefined) setFocusStepId(result.focusStepId)
    }

    async function renameNode(id: ID, newName: string) {
        if (!state) return
        const result = renameWorkspaceNode(state, id, newName)
        if (!result) return
        await persist(result.nextState)
        markDirty(result.dirtyIds)
    }

    async function deleteNodeById(id: ID) {
        if (!state) return
        const result = deleteNodeByIdCommand(state, id, selectedId)
        if (!result) return
        await persist(result.nextState)
        if (result.selectedId !== undefined) setSelectedId(result.selectedId)
        if (result.focusStepId !== undefined) setFocusStepId(result.focusStepId)
    }

    async function moveNode(nodeId: ID, targetFolderId: ID) {
        if (!state) return false
        const result = moveWorkspaceNode(state, nodeId, targetFolderId)
        if (result.moved) {
            await persist(result.nextState)
            if (result.selectedId) setSelectedId(result.selectedId)
        }
        return result.moved
    }

    async function save() {
        const saved = await saveWorkspaceUseCase(state)
        if (saved) clearDirty()
    }

    async function updateTest(
        testId: ID,
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ) {
        if (!state) return
        const result = updateTestCase(state, testId, patch)
        if (!result) return
        await persist(result.nextState)
        markDirty(result.dirtyIds)
    }

    async function addSharedStep(name = services.defaults.sharedStep, steps: Step[] = []) {
        if (!state) return null
        const result = addSharedStepCommand(state, name, steps)
        await persist(result.nextState)
        return result.sharedId
    }

    async function addSharedStepFromStep(step: Step, name?: string) {
        if (!state) return null
        const result = addSharedStepFromStepCommand(state, step, services.defaults.sharedStep, name)
        await persist(result.nextState)
        return result.sharedId
    }

    async function updateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>) {
        if (!state) return
        const result = updateSharedStepCommand(state, sharedId, patch)
        if (!result) return
        await persist(result.nextState)
    }

    async function deleteSharedStep(sharedId: string) {
        if (!state) return
        const result = deleteSharedStepCommand(state, sharedId)
        await persist(result.nextState)
        markDirty(result.dirtyIds)
    }

    async function insertSharedReference(testId: string, sharedId: string, afterIndex?: number) {
        if (!state) return
        const result = insertSharedReferenceCommand(state, testId, sharedId, afterIndex)
        if (!result) return
        await persist(result.nextState)
        markDirty(result.dirtyIds)
    }

    async function pull() {
        const result = await pullSelectedCase(state, selectedId, sync)
        if (result.status !== 'ok') return result
        await persist(result.nextState)
        clearDirty(result.clearedDirtyIds)
        return {
            status: result.status,
            testId: result.testId,
            externalId: result.externalId,
        }
    }

    async function push() {
        if (!state) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return
        await sync.pushTest(node, node.links[0], state)
    }

    async function syncAll(): Promise<SyncAllResult> {
        if (!state) return { status: 'ok', count: 0 }
        const next = structuredClone(state)
        const tests = mapTests(next.root)
        await sync.twoWaySync(next)
        await persist(next)
        clearDirty(tests.map((test) => test.id))
        return { status: 'ok', count: tests.length }
    }

    async function previewZephyrImport(
        request: Omit<ZephyrImportRequest, 'destinationFolderId'> & { destinationFolderId?: string }
    ): Promise<ZephyrImportPreview> {
        return previewZephyrImportUseCase(state, selectedId, sync, services.defaults.rootLabel, request)
    }

    async function applyZephyrImportPreview(preview: ZephyrImportPreview) {
        const { nextState, result, clearedDirtyIds } = await applyZephyrImportUseCase(state, preview, sync)
        await persist(nextState)
        clearDirty(clearedDirtyIds)
        return result
    }

    async function previewZephyrPublish(): Promise<ZephyrPublishPreview> {
        return previewZephyrPublishUseCase(state, selectedId, sync, services.defaults.rootLabel)
    }

    async function publishZephyr(preview: ZephyrPublishPreview): Promise<ZephyrPublishResult & { snapshotPath: string; logPath: string }> {
        const outcome = await publishZephyrPreviewUseCase(state, preview, sync)
        setState(structuredClone(outcome.nextState))
        clearDirty(outcome.clearedDirtyIds)
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

    return {
        state,
        selectedId,
        dirtyTestIds,
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
        mapAllTests: () => (state ? mapTests(state.root) : []),
    }
}
