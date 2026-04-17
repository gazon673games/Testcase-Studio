import { produce } from 'immer'
import {
    mkFolder,
    mkShared,
    mkStep,
    mkTest,
    nowISO,
    type Folder,
    type ID,
    type RootState,
    type SharedStep,
    type Step,
    type TestCase,
} from '@core/domain'
import { deleteNode, findNode, findParentFolder, insertChild, isFolder, mapTests, moveNode as moveTreeNode } from '@core/tree'
import { NODE_ALIAS_PARAM_KEY } from '@shared/treeAliases'
import { NODE_ICON_PARAM_KEY } from '@shared/treeIcons'
import { getSelectedNode } from './queries'

type TestPatch = Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>

type WorkspaceMutationResult = {
    nextState: RootState
    selectedId?: ID | null
    focusStepId?: string | null
    dirtyIds?: string[]
}

export function addFolderAt(state: RootState, parentId: ID, name: string): WorkspaceMutationResult {
    const folder = mkFolder(name)
    const nextState = produce(state, (draft) => {
        insertChild(draft.root, parentId, folder)
    })
    return { nextState, selectedId: folder.id }
}

export function addTestAt(state: RootState, parentId: ID, testName: string, firstStepAction: string): WorkspaceMutationResult {
    const test = mkTest(testName, '')
    const first = mkStep(firstStepAction, '', '')
    test.steps.push(first)
    const nextState = produce(state, (draft) => {
        insertChild(draft.root, parentId, test)
    })
    return { nextState, selectedId: test.id, focusStepId: first.id, dirtyIds: [test.id] }
}

export function addFolderFromSelection(state: RootState, selectedId: ID | null, name: string): WorkspaceMutationResult {
    return addFolderAt(state, resolveParentFolder(state, selectedId).id, name)
}

export function addTestFromSelection(state: RootState, selectedId: ID | null, testName: string, firstStepAction: string): WorkspaceMutationResult {
    return addTestAt(state, resolveParentFolder(state, selectedId).id, testName, firstStepAction)
}

export function removeSelectedNode(state: RootState, selectedId: ID | null): WorkspaceMutationResult | null {
    if (!selectedId || selectedId === state.root.id) return null
    const nextState = produce(state, (draft) => {
        deleteNode(draft.root, selectedId)
    })
    if (nextState === state) return null  // deleteNode found nothing
    return { nextState, selectedId: nextState.root.id, focusStepId: null }
}

export function renameWorkspaceNode(state: RootState, id: ID, newName: string): WorkspaceMutationResult | null {
    const nextState = produce(state, (draft) => {
        const node = findNode(draft.root, id)
        if (!node) return
        node.name = newName
        if (!isFolder(node)) node.updatedAt = nowISO()
    })
    if (nextState === state) return null

    const node = findNode(nextState.root, id)
    return {
        nextState,
        dirtyIds: node && !isFolder(node) ? [node.id] : undefined,
    }
}

export function deleteNodeById(state: RootState, id: ID, currentSelectedId: ID | null): WorkspaceMutationResult | null {
    if (id === state.root.id) return null
    const nextState = produce(state, (draft) => {
        deleteNode(draft.root, id)
    })
    if (nextState === state) return null
    return {
        nextState,
        selectedId: currentSelectedId === id ? nextState.root.id : undefined,
        focusStepId: currentSelectedId === id ? null : undefined,
    }
}

export function moveWorkspaceNode(state: RootState, nodeId: ID, targetFolderId: ID): WorkspaceMutationResult & { moved: boolean } {
    let moved = false
    const nextState = produce(state, (draft) => {
        moved = moveTreeNode(draft.root, nodeId, targetFolderId)
    })
    return { nextState, moved, selectedId: moved ? nodeId : undefined }
}

export function updateTestCase(state: RootState, testId: ID, patch: TestPatch): WorkspaceMutationResult | null {
    const nextState = produce(state, (draft) => {
        const node = findNode(draft.root, testId)
        if (!node || isFolder(node)) return
        Object.assign(node, patch)
        node.updatedAt = nowISO()
    })
    if (nextState === state) return null
    return { nextState, dirtyIds: [testId] }
}

export function setNodeIcon(state: RootState, nodeId: ID, iconKey: string | null): WorkspaceMutationResult | null {
    const normalizedKey = String(iconKey ?? '').trim()
    const nextState = produce(state, (draft) => {
        const node = findNode(draft.root, nodeId)
        if (!node) return

        if (isFolder(node)) {
            if (normalizedKey) node.iconKey = normalizedKey
            else delete node.iconKey
            return
        }

        node.details = node.details ?? { tags: [], attributes: {} }
        node.details.attributes = node.details.attributes ?? {}
        if (normalizedKey) node.details.attributes[NODE_ICON_PARAM_KEY] = normalizedKey
        else delete node.details.attributes[NODE_ICON_PARAM_KEY]
        node.updatedAt = nowISO()
    })
    if (nextState === state) return null

    const node = findNode(nextState.root, nodeId)
    return { nextState, dirtyIds: node && !isFolder(node) ? [nodeId] : undefined }
}

export function setNodeAlias(state: RootState, nodeId: ID, alias: string | null): WorkspaceMutationResult | null {
    const normalizedAlias = String(alias ?? '').trim()
    const nextState = produce(state, (draft) => {
        const node = findNode(draft.root, nodeId)
        if (!node) return

        if (isFolder(node)) {
            if (normalizedAlias) node.alias = normalizedAlias
            else delete node.alias
            return
        }

        node.details = node.details ?? { tags: [], attributes: {} }
        node.details.attributes = node.details.attributes ?? {}
        if (normalizedAlias) node.details.attributes[NODE_ALIAS_PARAM_KEY] = normalizedAlias
        else delete node.details.attributes[NODE_ALIAS_PARAM_KEY]
        node.updatedAt = nowISO()
    })
    if (nextState === state) return null

    const node = findNode(nextState.root, nodeId)
    return { nextState, dirtyIds: node && !isFolder(node) ? [nodeId] : undefined }
}

export function setTestIcon(state: RootState, testId: ID, iconKey: string | null): WorkspaceMutationResult | null {
    return setNodeIcon(state, testId, iconKey)
}

export function addSharedStep(state: RootState, name: string, steps: Step[] = []): WorkspaceMutationResult & { sharedId: string } {
    const shared = mkShared(name, steps.length ? structuredClone(steps) : [mkStep()])
    const nextState = produce(state, (draft) => {
        draft.sharedSteps.push(shared)
    })
    return { nextState, sharedId: shared.id }
}

export function addSharedStepFromStep(state: RootState, step: Step, fallbackName: string, explicitName?: string) {
    const baseName = (step.action || step.text || fallbackName).trim() || fallbackName
    return addSharedStep(state, explicitName ?? baseName, [structuredClone(step)])
}

export function updateSharedStep(state: RootState, sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): WorkspaceMutationResult | null {
    const nextState = produce(state, (draft) => {
        const shared = draft.sharedSteps.find((item) => item.id === sharedId)
        if (!shared) return
        if (typeof patch.name === 'string') shared.name = patch.name
        if (Array.isArray(patch.steps)) shared.steps = structuredClone(patch.steps)
        shared.updatedAt = nowISO()
    })
    if (nextState === state) return null
    return { nextState }
}

export function deleteSharedStep(state: RootState, sharedId: string): WorkspaceMutationResult {
    const dirtyIds: string[] = []
    const nextState = produce(state, (draft) => {
        draft.sharedSteps = draft.sharedSteps.filter((item) => item.id !== sharedId)
        for (const test of mapTests(draft.root)) {
            const before = test.steps.length
            test.steps = test.steps.filter((step) => step.usesShared !== sharedId)
            if (test.steps.length !== before) {
                test.updatedAt = nowISO()
                dirtyIds.push(test.id)
            }
        }
    })
    return { nextState, dirtyIds }
}

export function insertSharedReference(state: RootState, testId: string, sharedId: string, afterIndex?: number): WorkspaceMutationResult | null {
    const nextState = produce(state, (draft) => {
        const node = findNode(draft.root, testId)
        if (!node || isFolder(node)) return
        const insertAt = typeof afterIndex === 'number' ? afterIndex + 1 : node.steps.length
        node.steps.splice(insertAt, 0, mkSharedPlaceholder(sharedId))
        node.updatedAt = nowISO()
    })
    if (nextState === state) return null
    return { nextState, dirtyIds: [testId] }
}

function resolveParentFolder(state: RootState, selectedId: ID | null): Folder {
    const selected = getSelectedNode(state, selectedId)
    if (!selected) return state.root
    if (isFolder(selected)) return selected
    return findParentFolder(state.root, selected.id) ?? state.root
}

function mkSharedPlaceholder(sharedId: string): Step {
    return {
        id: crypto.randomUUID(),
        action: '',
        data: '',
        expected: '',
        text: '',
        snapshot: { action: '', data: '', expected: '' },
        presentation: { parts: { action: [], data: [], expected: [] } },
        subSteps: [],
        attachments: [],
        usesShared: sharedId,
    }
}
