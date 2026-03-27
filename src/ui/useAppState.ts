import * as React from 'react'
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
import { loadState, saveState } from '@core/storage'
import {
    deleteNode,
    findNode,
    findParentFolder,
    insertChild,
    isFolder,
    mapTests,
    moveNode as moveTreeNode,
} from '@core/tree'
import { SyncEngine } from '@core/syncEngine'
import { ZephyrHttpProvider } from '@providers/zephyr.http'
import { AllureStubProvider } from '@providers/allure.stub'
import { fromProviderPayload } from '@providers/mappers'

type Node = Folder | TestCase

function mkSharedPlaceholder(sharedId: string): Step {
    return {
        id: crypto.randomUUID(),
        action: '',
        data: '',
        expected: '',
        text: '',
        raw: { action: '', data: '', expected: '' },
        internal: { parts: { action: [], data: [], expected: [] } },
        subSteps: [],
        attachments: [],
        usesShared: sharedId,
    }
}

export function useAppState() {
    const [state, setState] = React.useState<RootState | null>(null)
    const [selectedId, setSelectedId] = React.useState<ID | null>(null)
    const [focusStepId, setFocusStepId] = React.useState<string | null>(null)

    const providers = React.useMemo(
        () => ({ zephyr: new ZephyrHttpProvider(), allure: new AllureStubProvider() }),
        []
    )
    const sync = React.useMemo(() => new SyncEngine(providers), [providers])

    React.useEffect(() => {
        loadState().then((nextState) => {
            setState(nextState)
            setSelectedId(nextState.root.id)
        })
    }, [])

    async function persist(next: RootState) {
        setState(structuredClone(next))
        await saveState(next)
    }

    function getSelected(): Node | null {
        if (!state || !selectedId) return null
        return findNode(state.root, selectedId) as Node | null
    }

    function select(id: ID) {
        setSelectedId(id)
        setFocusStepId(null)
    }

    async function addFolderAt(parentId: ID) {
        if (!state) return
        const next = structuredClone(state)
        const folder = mkFolder('New Folder')
        insertChild(next.root, parentId, folder)
        await persist(next)
        setSelectedId(folder.id)
    }

    async function addTestAt(parentId: ID) {
        if (!state) return
        const test = mkTest('New Test', '')
        const first = mkStep('Step 1', '', '')
        test.steps.push(first)

        const next = structuredClone(state)
        insertChild(next.root, parentId, test)
        await persist(next)
        setSelectedId(test.id)
        setFocusStepId(first.id)
    }

    async function addFolder() {
        if (!state) return
        const selected = getSelected()
        const parentFolder =
            !selected
                ? state.root
                : isFolder(selected)
                    ? selected
                    : findParentFolder(state.root, selected.id) ?? state.root
        await addFolderAt(parentFolder.id)
    }

    async function addTest() {
        if (!state) return
        const selected = getSelected()
        const parentFolder =
            !selected
                ? state.root
                : isFolder(selected)
                    ? selected
                    : findParentFolder(state.root, selected.id) ?? state.root
        await addTestAt(parentFolder.id)
    }

    async function removeSelected() {
        if (!state || !selectedId || selectedId === state.root.id) return
        const next = structuredClone(state)
        if (!deleteNode(next.root, selectedId)) return

        await persist(next)
        setSelectedId(next.root.id)
        setFocusStepId(null)
    }

    async function renameNode(id: ID, newName: string) {
        if (!state) return
        const next = structuredClone(state)
        const node = findNode(next.root, id)
        if (!node) return

        if (isFolder(node)) node.name = newName
        else {
            node.name = newName
            node.updatedAt = nowISO()
        }

        await persist(next)
    }

    async function deleteNodeById(id: ID) {
        if (!state || id === state.root.id) return
        const next = structuredClone(state)
        if (!deleteNode(next.root, id)) return

        await persist(next)
        if (selectedId === id) {
            setSelectedId(next.root.id)
            setFocusStepId(null)
        }
    }

    async function moveNode(nodeId: ID, targetFolderId: ID) {
        if (!state) return false
        const next = structuredClone(state)
        const moved = moveTreeNode(next.root, nodeId, targetFolderId)
        if (moved) {
            await persist(next)
            setSelectedId(nodeId)
        }
        return moved
    }

    async function save() {
        if (state) await saveState(state)
    }

    async function updateTest(
        testId: ID,
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ) {
        if (!state) return
        const next = structuredClone(state)
        const node = findNode(next.root, testId) as TestCase | null
        if (!node || isFolder(node as any)) return

        Object.assign(node, patch)
        node.updatedAt = nowISO()
        await persist(next)
    }

    async function addSharedStep(name = 'New Shared Step', steps: Step[] = []) {
        if (!state) return null
        const next = structuredClone(state)
        const shared = mkShared(name, steps.length ? structuredClone(steps) : [mkStep()])
        next.sharedSteps.push(shared)
        await persist(next)
        return shared.id
    }

    async function addSharedStepFromStep(step: Step, name?: string) {
        const baseName = (step.action || step.text || 'Shared Step').trim() || 'Shared Step'
        return addSharedStep(name ?? baseName, [structuredClone(step)])
    }

    async function updateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>) {
        if (!state) return
        const next = structuredClone(state)
        const shared = next.sharedSteps.find((item) => item.id === sharedId)
        if (!shared) return

        if (typeof patch.name === 'string') shared.name = patch.name
        if (Array.isArray(patch.steps)) shared.steps = structuredClone(patch.steps)
        shared.updatedAt = nowISO()
        await persist(next)
    }

    async function deleteSharedStep(sharedId: string) {
        if (!state) return
        const next = structuredClone(state)
        next.sharedSteps = next.sharedSteps.filter((item) => item.id !== sharedId)

        for (const test of mapTests(next.root)) {
            test.steps = test.steps.filter((step) => step.usesShared !== sharedId)
            test.updatedAt = nowISO()
        }

        await persist(next)
    }

    async function insertSharedReference(testId: string, sharedId: string, afterIndex?: number) {
        if (!state) return
        const next = structuredClone(state)
        const node = findNode(next.root, testId) as TestCase | null
        if (!node || isFolder(node as any)) return

        const insertAt = typeof afterIndex === 'number' ? afterIndex + 1 : node.steps.length
        node.steps.splice(insertAt, 0, mkSharedPlaceholder(sharedId))
        node.updatedAt = nowISO()
        await persist(next)
    }

    async function pull() {
        if (!state) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return

        const remote = await sync.pullPreferZephyr(node)
        if (!remote) return

        const next = structuredClone(state)
        const target = findNode(next.root, node.id) as TestCase
        const patch = fromProviderPayload(remote, target.steps)

        target.name = patch.name
        target.description = patch.description
        target.steps = patch.steps
        target.attachments = patch.attachments
        target.meta = patch.meta
        target.updatedAt = patch.updatedAt ?? nowISO()

        await persist(next)
    }

    async function push() {
        if (!state) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return
        await sync.pushTest(node, node.links[0], state)
    }

    async function syncAll() {
        if (!state) return
        const next = structuredClone(state)
        await sync.twoWaySync(next)
        await persist(next)
    }

    function openStep(testId: string, stepId: string) {
        setSelectedId(testId)
        setFocusStepId(stepId)
    }

    return {
        state,
        selectedId,
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
