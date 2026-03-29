import * as React from 'react'
import {
    applyZephyrImport as applyZephyrImportUseCase,
    getImportDestination as getImportDestinationQuery,
    getPublishSelection as getPublishSelectionQuery,
    getSelectedNode,
    loadWorkspaceState,
    previewZephyrImport as previewZephyrImportUseCase,
    previewZephyrPublish as previewZephyrPublishUseCase,
    publishZephyrPreview as publishZephyrPreviewUseCase,
    pullSelectedCase,
    saveWorkspace as saveWorkspaceUseCase,
} from '@app/workspace'
import { SyncEngine, type ZephyrImportPreview, type ZephyrImportRequest, type ZephyrPublishPreview, type ZephyrPublishResult } from '@app/sync'
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
import {
    deleteNode,
    findNode,
    findParentFolder,
    insertChild,
    isFolder,
    mapTests,
    moveNode as moveTreeNode,
} from '@core/tree'
import { ZephyrHttpProvider } from '@providers/zephyr.http'
import { AllureStubProvider } from '@providers/allure.stub'
import { translate } from '@shared/i18n'

type Node = Folder | TestCase
type SyncAllResult = { status: 'ok'; count: number }

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
    const [dirtyTestIds, setDirtyTestIds] = React.useState<Set<string>>(() => new Set())

    const providers = React.useMemo(
        () => ({ zephyr: new ZephyrHttpProvider(), allure: new AllureStubProvider() }),
        []
    )
    const sync = React.useMemo(() => new SyncEngine(providers), [providers])

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
        return getImportDestinationQuery(state, selectedId, translate('defaults.root'))
    }

    function getPublishSelection() {
        return getPublishSelectionQuery(state, selectedId, translate('defaults.root'))
    }

    async function addFolderAt(parentId: ID) {
        if (!state) return
        const next = structuredClone(state)
        const folder = mkFolder(translate('defaults.newFolder'))
        insertChild(next.root, parentId, folder)
        await persist(next)
        setSelectedId(folder.id)
    }

    async function addTestAt(parentId: ID) {
        if (!state) return
        const test = mkTest(translate('defaults.newCase'), '')
        const first = mkStep(translate('defaults.firstStep'), '', '')
        test.steps.push(first)

        const next = structuredClone(state)
        insertChild(next.root, parentId, test)
        await persist(next)
        markDirty([test.id])
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
            markDirty([node.id])
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
        const saved = await saveWorkspaceUseCase(state)
        if (saved) clearDirty()
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
        markDirty([testId])
    }

    async function addSharedStep(name = translate('defaults.sharedStep'), steps: Step[] = []) {
        if (!state) return null
        const next = structuredClone(state)
        const shared = mkShared(name, steps.length ? structuredClone(steps) : [mkStep()])
        next.sharedSteps.push(shared)
        await persist(next)
        return shared.id
    }

    async function addSharedStepFromStep(step: Step, name?: string) {
        const baseName = (step.action || step.text || translate('defaults.sharedStep')).trim() || translate('defaults.sharedStep')
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
            const beforeLength = test.steps.length
            test.steps = test.steps.filter((step) => step.usesShared !== sharedId)
            if (test.steps.length !== beforeLength) {
                test.updatedAt = nowISO()
                markDirty([test.id])
            }
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
        markDirty([testId])
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
        return previewZephyrImportUseCase(state, selectedId, sync, translate('defaults.root'), request)
    }

    async function applyZephyrImportPreview(preview: ZephyrImportPreview) {
        const { nextState, result, clearedDirtyIds } = await applyZephyrImportUseCase(state, preview, sync)
        await persist(nextState)
        clearDirty(clearedDirtyIds)
        return result
    }

    async function previewZephyrPublish(): Promise<ZephyrPublishPreview> {
        return previewZephyrPublishUseCase(state, selectedId, sync, translate('defaults.root'))
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
