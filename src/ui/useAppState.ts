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
import {
    describeFolderPath,
    type ZephyrImportApplyResult,
    type ZephyrImportPreview,
    type ZephyrImportRequest,
} from '@core/zephyrImport'
import type { ZephyrPublishPreview, ZephyrPublishResult } from '@core/zephyrPublish'
import { ZephyrHttpProvider } from '@providers/zephyr.http'
import { AllureStubProvider } from '@providers/allure.stub'
import { fromProviderPayload } from '@providers/mappers'
import { apiClient } from '@ipc/client'
import { translate } from './preferences'

type Node = Folder | TestCase
type PullResult =
    | { status: 'ok'; testId: string; externalId: string }
    | { status: 'no-selection' | 'not-a-test' | 'no-link' }
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
        loadState().then((nextState) => {
            setState(nextState)
            setSelectedId(nextState.root.id)
        })
    }, [])

    async function persist(next: RootState) {
        setState(structuredClone(next))
        await saveState(next)
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
        if (!state || !selectedId) return null
        return findNode(state.root, selectedId) as Node | null
    }

    function select(id: ID) {
        setSelectedId(id)
        setFocusStepId(null)
    }

    function getImportDestination() {
        if (!state) return { folderId: '', label: translate('defaults.root') }
        const selected = getSelected()
        const folder =
            !selected
                ? state.root
                : isFolder(selected)
                    ? selected
                    : findParentFolder(state.root, selected.id) ?? state.root
        return {
            folderId: folder.id,
            label: describeFolderPath(state.root, folder.id),
        }
    }

    function getPublishSelection() {
        if (!state) return { label: translate('defaults.root'), tests: [] as TestCase[] }
        const selected = getSelected()
        if (!selected) return { label: describeFolderPath(state.root, state.root.id), tests: mapTests(state.root) }
        if (!isFolder(selected)) return { label: selected.name, tests: [selected] }
        return {
            label: describeFolderPath(state.root, selected.id),
            tests: mapTests(selected),
        }
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
        if (state) {
            await saveState(state)
            clearDirty()
        }
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

    async function pull(): Promise<PullResult> {
        if (!state) return { status: 'no-selection' }
        const node = getSelected()
        if (!node) return { status: 'no-selection' }
        if (isFolder(node)) return { status: 'not-a-test' }
        if (node.links.length === 0) return { status: 'no-link' }

        const remote = await sync.pullPreferZephyr(node)
        if (!remote) return { status: 'no-link' }

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
        clearDirty([target.id])
        return {
            status: 'ok',
            testId: target.id,
            externalId: node.links.find((link) => link.provider === 'zephyr')?.externalId
                ?? node.links[0]?.externalId
                ?? remote.id
                ?? '',
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
        if (!state) throw new Error('State is not loaded yet')
        const destinationFolderId = request.destinationFolderId || getImportDestination().folderId || state.root.id
        return sync.previewZephyrImport(state, { ...request, destinationFolderId })
    }

    async function applyZephyrImport(preview: ZephyrImportPreview): Promise<ZephyrImportApplyResult> {
        if (!state) throw new Error('State is not loaded yet')
        const next = structuredClone(state)
        const result = sync.applyZephyrImport(next, preview)
        await persist(next)
        clearDirty(preview.items.map((item) => item.localTestId ?? ''))
        return result
    }

    async function previewZephyrPublish(): Promise<ZephyrPublishPreview> {
        if (!state) throw new Error('State is not loaded yet')
        const selection = getPublishSelection()
        return sync.previewZephyrPublish(state, selection.tests, selection.label)
    }

    async function publishZephyr(preview: ZephyrPublishPreview): Promise<ZephyrPublishResult & {
        snapshotPath: string
        logPath: string
    }> {
        if (!state) throw new Error('State is not loaded yet')
        const snapshotPath = await apiClient.writeStateSnapshot(state, 'publish', {
            selectionLabel: preview.selectionLabel,
            generatedAt: preview.generatedAt,
            summary: preview.summary,
        })

        const next = structuredClone(state)
        const result = await sync.publishZephyrPreview(next, preview)
        await persist(next)
        clearDirty(preview.items.map((item) => item.testId))

        const logPath = await apiClient.writePublishLog({
            kind: 'zephyr-publish',
            createdAt: nowISO(),
            snapshotPath,
            preview: {
                selectionLabel: preview.selectionLabel,
                generatedAt: preview.generatedAt,
                summary: preview.summary,
                items: preview.items.map((item) => ({
                    testId: item.testId,
                    testName: item.testName,
                    externalId: item.externalId,
                    status: item.status,
                    publish: item.publish,
                    reason: item.reason,
                    projectKey: item.projectKey,
                    folder: item.folder,
                    diffs: item.diffs,
                    attachmentWarnings: item.attachmentWarnings,
                })),
            },
            result,
        })

        return { ...result, snapshotPath, logPath }
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
        applyZephyrImport,
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
