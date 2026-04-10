import {
    addFolderAt as addFolderAtCommand,
    addFolderFromSelection,
    addSharedStep as addSharedStepCommand,
    addSharedStepFromStep as addSharedStepFromStepCommand,
    addTestAt as addTestAtCommand,
    addTestFromSelection,
    deleteNodeById as deleteNodeByIdCommand,
    deleteSharedStep as deleteSharedStepCommand,
    insertSharedReference as insertSharedReferenceCommand,
    moveWorkspaceNode,
    removeSelectedNode,
    renameWorkspaceNode,
    resolveIncludedCaseDecisions,
    setNodeAlias as setNodeAliasCommand,
    setNodeIcon as setNodeIconCommand,
    updateSharedStep as updateSharedStepCommand,
    updateTestCase,
    type IncludedCaseResolution,
} from '@app/workspace'
import type { ID, RootState, SharedStep, Step, TestCase } from '@core/domain'
import type { AppServices } from '../services'

type AppStateWorkspaceActionsOptions = {
    getCurrentState: () => RootState | null
    selectedId: ID | null
    defaults: AppServices['defaults']
    stageLocalState: (next: RootState, dirtyIds?: string[]) => void
    persistStateNow: (next: RootState, dirtyIds?: string[]) => Promise<void>
    setSelectedId: (id: ID | null) => void
    setFocusStepId: (stepId: string | null) => void
}

export function createAppStateWorkspaceActions({
    getCurrentState,
    selectedId,
    defaults,
    stageLocalState,
    persistStateNow,
    setSelectedId,
    setFocusStepId,
}: AppStateWorkspaceActionsOptions) {
    async function addFolderAt(parentId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addFolderAtCommand(currentState, parentId, defaults.newFolder)
        await persistStateNow(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTestAt(parentId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addTestAtCommand(currentState, parentId, defaults.newCase, defaults.firstStep)
        await persistStateNow(result.nextState, result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function addFolder() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addFolderFromSelection(currentState, selectedId, defaults.newFolder)
        await persistStateNow(result.nextState)
        if (result.selectedId) setSelectedId(result.selectedId)
    }

    async function addTest() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = addTestFromSelection(currentState, selectedId, defaults.newCase, defaults.firstStep)
        await persistStateNow(result.nextState, result.dirtyIds)
        if (result.selectedId) setSelectedId(result.selectedId)
        if (result.focusStepId) setFocusStepId(result.focusStepId)
    }

    async function removeSelected() {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = removeSelectedNode(currentState, selectedId)
        if (!result) return
        await persistStateNow(result.nextState, result.dirtyIds)
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
        await persistStateNow(result.nextState, result.dirtyIds)
        if (result.selectedId !== undefined) setSelectedId(result.selectedId)
        if (result.focusStepId !== undefined) setFocusStepId(result.focusStepId)
    }

    async function moveNode(nodeId: ID, targetFolderId: ID) {
        const currentState = getCurrentState()
        if (!currentState) return false
        const result = moveWorkspaceNode(currentState, nodeId, targetFolderId)
        if (result.moved) {
            await persistStateNow(result.nextState)
            if (result.selectedId) setSelectedId(result.selectedId)
        }
        return result.moved
    }

    async function updateTest(
        testId: ID,
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
    ) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = updateTestCase(currentState, testId, patch)
        if (!result) return
        stageLocalState(result.nextState, result.dirtyIds)
    }

    async function setNodeIcon(nodeId: ID, iconKey: string | null) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = setNodeIconCommand(currentState, nodeId, iconKey)
        if (!result) return
        await persistStateNow(result.nextState, result.dirtyIds)
    }

    async function setNodeAlias(nodeId: ID, alias: string | null) {
        const currentState = getCurrentState()
        if (!currentState) return
        const result = setNodeAliasCommand(currentState, nodeId, alias)
        if (!result) return
        await persistStateNow(result.nextState, result.dirtyIds)
    }

    async function addSharedStep(name = defaults.sharedStep, steps: Step[] = []) {
        const currentState = getCurrentState()
        if (!currentState) return null
        const result = addSharedStepCommand(currentState, name, steps)
        stageLocalState(result.nextState)
        return result.sharedId
    }

    async function addSharedStepFromStep(step: Step, name?: string) {
        const currentState = getCurrentState()
        if (!currentState) return null
        const result = addSharedStepFromStepCommand(currentState, step, defaults.sharedStep, name)
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

    async function resolveIncludedCases(decisions: Record<string, IncludedCaseResolution>) {
        const currentState = getCurrentState()
        if (!currentState) return null
        if (!Object.keys(decisions).length) return null
        const result = resolveIncludedCaseDecisions(currentState, decisions)
        stageLocalState(result.nextState, result.dirtyIds)
        return result
    }

    return {
        addFolderAt,
        addTestAt,
        addFolder,
        addTest,
        removeSelected,
        renameNode,
        deleteNodeById,
        moveNode,
        updateTest,
        setNodeAlias,
        setNodeIcon,
        addSharedStep,
        addSharedStepFromStep,
        updateSharedStep,
        deleteSharedStep,
        insertSharedReference,
        resolveIncludedCases,
    }
}
