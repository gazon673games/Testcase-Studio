import * as React from 'react'
import { mkFolder, mkTest, mkStep, type RootState, type Folder, type TestCase, type ID } from '@core/domain'
import { loadState, saveState } from '@core/storage'
import { insertChild, deleteNode, isFolder, findNode, findParentFolder, moveNode as moveTreeNode, mapTests } from '@core/tree'
import { SyncEngine } from '@core/syncEngine'
import { ZephyrMockProvider } from '@providers/zephyr.mock'
import { AllureStubProvider } from '@providers/allure.stub'

type Node = Folder | TestCase

export function useAppState() {
    const [state, setState] = React.useState<RootState | null>(null)
    const [selectedId, setSelectedId] = React.useState<ID | null>(null)
    /** какой шаг подсветить/проскроллить в редакторе */
    const [focusStepId, setFocusStepId] = React.useState<string | null>(null)

    const providers = React.useMemo(() => ({ zephyr: new ZephyrMockProvider(), allure: new AllureStubProvider() }), [])
    const sync = React.useMemo(() => new SyncEngine(providers), [providers])

    React.useEffect(() => { loadState().then(s => { setState(s); setSelectedId(s.root.id) }) }, [])

    async function persist(next: RootState) {
        setState(structuredClone(next))
        await saveState(next)
    }

    function getSelected(): Node | null {
        if (!state || !selectedId) return null
        return findNode(state.root, selectedId) as Node | null
    }

    function select(id: ID) { setSelectedId(id); setFocusStepId(null) }

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
        // 👉 по умолчанию — ОДИН шаг
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
        const sel = getSelected()
        const parentFolder = !sel ? state.root : (isFolder(sel) ? sel : findParentFolder(state.root, sel.id) ?? state.root)
        await addFolderAt(parentFolder.id)
    }

    async function addTest() {
        if (!state) return
        const sel = getSelected()
        const parentFolder = !sel ? state.root : (isFolder(sel) ? sel : findParentFolder(state.root, sel.id) ?? state.root)
        await addTestAt(parentFolder.id)
    }

    async function removeSelected() {
        if (!state || !selectedId) return
        if (selectedId === state.root.id) return
        const next = structuredClone(state)
        const ok = deleteNode(next.root, selectedId)
        if (ok) { await persist(next); setSelectedId(next.root.id); setFocusStepId(null) }
    }

    async function renameNode(id: ID, newName: string) {
        if (!state) return
        const next = structuredClone(state)
        const node = findNode(next.root, id)
        if (!node) return
        if (isFolder(node)) node.name = newName
        else { node.name = newName; (node as TestCase).updatedAt = new Date().toISOString() }
        await persist(next)
    }

    async function deleteNodeById(id: ID) {
        if (!state) return
        if (id === state.root.id) return
        const next = structuredClone(state)
        if (deleteNode(next.root, id)) {
            await persist(next)
            if (selectedId === id) { setSelectedId(next.root.id); setFocusStepId(null) }
        }
    }

    async function moveNode(nodeId: ID, targetFolderId: ID) {
        if (!state) return false
        const next = structuredClone(state)
        const ok = moveTreeNode(next.root, nodeId, targetFolderId)
        if (ok) { await persist(next); setSelectedId(nodeId) }
        return ok
    }

    async function save() { if (state) await saveState(state) }

    // 🆕: разрешаем патчить meta
    async function updateTest(testId: ID, patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta'>>) {
        if (!state) return
        const next = structuredClone(state)
        const node = findNode(next.root, testId) as TestCase | null
        if (!node || isFolder(node as any)) return
        Object.assign(node, patch)
        node.updatedAt = new Date().toISOString()
        await persist(next)
    }

    async function pull() {
        if (!state) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return
        const link = node.links[0]
        const remote = await sync.pullTestDetails(link)
        const next = structuredClone(state)
        const target = findNode(next.root, node.id) as TestCase
        target.name = remote.name
        target.description = remote.description
        target.steps = remote.steps
        target.attachments = remote.attachments
        target.updatedAt = remote.updatedAt ?? new Date().toISOString()
        await persist(next)
    }

    async function push() {
        if (!state) return
        const node = getSelected()
        if (!node || isFolder(node) || node.links.length === 0) return
        const link = node.links[0]
        await sync.pushTest(node, link, state)
    }

    async function syncAll() {
        if (!state) return
        const next = structuredClone(state)
        await sync.twoWaySync(next)
        await persist(next)
    }

    /** Даблклик по шагу в дереве */
    function openStep(testId: string, stepId: string) {
        setSelectedId(testId)
        setFocusStepId(stepId)
    }

    return {
        state, selectedId, select,
        addFolder, addTest, removeSelected, save,
        updateTest,
        pull, push, syncAll,
        addFolderAt, addTestAt, renameNode, deleteNodeById, moveNode,
        openStep, focusStepId,
        mapAllTests: () => state ? mapTests(state.root) : []
    }
}
