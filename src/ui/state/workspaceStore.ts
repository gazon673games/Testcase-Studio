import { create } from 'zustand'
import {
    loadWorkspaceState,
    saveWorkspace as saveWorkspaceUseCase,
    getAllTests,
    getImportDestination as getImportDestinationQuery,
    getPublishSelection as getPublishSelectionQuery,
    getSelectedNode,
    addFolderAt as addFolderAtCommand,
    addFolderFromSelection,
    addTestAt as addTestAtCommand,
    addTestFromSelection,
    addSharedStep as addSharedStepCommand,
    addSharedStepFromStep as addSharedStepFromStepCommand,
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
    collectIncludedCaseCandidates,
    pullSelectedCase,
    pushSelectedCase as pushSelectedCaseUseCase,
    applyZephyrImport as applyZephyrImportUseCase,
    previewZephyrImport as previewZephyrImportUseCase,
    previewZephyrPublish as previewZephyrPublishUseCase,
    publishZephyrPreview as publishZephyrPreviewUseCase,
    type IncludedCaseResolution,
} from '@app/workspace'
import type { ID, RootState, SharedStep, Step, TestCase } from '@core/domain'
import type { ZephyrImportPreview, ZephyrImportRequest, ZephyrPublishPreview, ZephyrPublishResult } from '@app/sync'
import type { AppServices } from '../services'

// ─── Autosave queue ──────────────────────────────────────────────────────────
// These live outside Zustand state — they're imperative bookkeeping that never
// needs to trigger re-renders.
let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _saveQueue: Promise<void> = Promise.resolve()
let _activeSaves = 0
let _revision = 0

// ─── Store types ─────────────────────────────────────────────────────────────

export type WorkspaceStore = {
    // ── Observed state ──────────────────────────────────────────────────────
    state: RootState | null
    selectedId: ID | null
    focusStepId: string | null
    dirtyTestIds: Set<string>
    loadError: string | null
    hasUnsavedChanges: boolean
    isSaving: boolean
    saveError: string | null

    // ── Services (locale-sensitive, updated on language change) ─────────────
    _services: AppServices | null
    setServices(services: AppServices): void

    // ── Lifecycle ───────────────────────────────────────────────────────────
    load(): Promise<void>
    save(): Promise<boolean>

    // ── Selection ───────────────────────────────────────────────────────────
    select(id: ID): void
    openStep(testId: string, stepId: string): void
    mapAllTests(): TestCase[]
    getImportDestination(): ReturnType<typeof getImportDestinationQuery>
    getPublishSelection(): ReturnType<typeof getPublishSelectionQuery>

    // ── Workspace commands ───────────────────────────────────────────────────
    addFolder(): Promise<void>
    addFolderAt(parentId: ID): Promise<void>
    addTest(): Promise<void>
    addTestAt(parentId: ID): Promise<void>
    removeSelected(): Promise<void>
    deleteNodeById(id: ID): Promise<void>
    moveNode(nodeId: ID, targetFolderId: ID): Promise<boolean>
    renameNode(id: ID, newName: string): void
    updateTest(testId: ID, patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>): void
    setNodeAlias(nodeId: ID, alias: string | null): Promise<void>
    setNodeIcon(nodeId: ID, iconKey: string | null): Promise<void>
    addSharedStep(name?: string, steps?: Step[]): Promise<string | null>
    addSharedStepFromStep(step: Step, name?: string): Promise<string | null>
    updateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void
    deleteSharedStep(sharedId: string): void
    insertSharedReference(testId: string, sharedId: string, afterIndex?: number): void
    resolveIncludedCases(decisions: Record<string, IncludedCaseResolution>): Promise<ReturnType<typeof resolveIncludedCaseDecisions> | null>

    // ── Sync actions ─────────────────────────────────────────────────────────
    pull(): Promise<{ status: 'no-selection' | 'no-link' | 'not-a-test' } | { status: 'ok'; testId: string; externalId: string; nextState: RootState; includedCases: ReturnType<typeof collectIncludedCaseCandidates> }>
    push(): Promise<Awaited<ReturnType<typeof pushSelectedCaseUseCase>>>
    syncAll(): Promise<{ status: 'ok'; count: number }>
    previewZephyrImport(request: Omit<ZephyrImportRequest, 'destinationFolderId'> & { destinationFolderId?: string }): Promise<ZephyrImportPreview>
    applyZephyrImport(preview: ZephyrImportPreview): Promise<{ nextState: RootState; includedCases: ReturnType<typeof collectIncludedCaseCandidates> } & Awaited<ReturnType<typeof applyZephyrImportUseCase>>['result']>
    previewZephyrPublish(): Promise<ZephyrPublishPreview>
    publishZephyr(preview: ZephyrPublishPreview): Promise<ZephyrPublishResult & { snapshotPath: string; logPath: string }>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => {
    // ── Internal helpers ────────────────────────────────────────────────────

    function services(): AppServices {
        const s = get()._services
        if (!s) throw new Error('WorkspaceStore: services not initialised')
        return s
    }

    function cancelScheduledSave() {
        if (_saveTimer === null) return
        clearTimeout(_saveTimer)
        _saveTimer = null
    }

    async function runQueuedSave(snapshot: RootState, rev: number) {
        _activeSaves++
        set({ isSaving: true, saveError: null })
        try {
            const saved = await saveWorkspaceUseCase(snapshot)
            if (!saved) return false
            if (_revision === rev) {
                set({ hasUnsavedChanges: false })
                clearDirty()
            }
            return true
        } catch (error) {
            if (_revision === rev) {
                set({ hasUnsavedChanges: true, saveError: error instanceof Error ? error.message : String(error) })
            }
            throw error
        } finally {
            _activeSaves--
            if (_activeSaves === 0) set({ isSaving: false })
        }
    }

    function enqueueSave(snapshot: RootState, rev: number) {
        const job = _saveQueue
            .catch(() => undefined)
            .then(() => runQueuedSave(snapshot, rev))
            .then(() => undefined)
        _saveQueue = job.catch(() => undefined)
        return job
    }

    function stageLocalState(next: RootState, dirtyIds?: string[]) {
        _revision++
        set({ state: next, hasUnsavedChanges: true, saveError: null })
        markDirty(dirtyIds)
        cancelScheduledSave()
    }

    async function persistStateNow(next: RootState, dirtyIds?: string[]) {
        _revision++
        const rev = _revision
        set({ state: next, hasUnsavedChanges: true, saveError: null })
        markDirty(dirtyIds)
        cancelScheduledSave()
        await enqueueSave(next, rev)
    }

    function markDirty(ids?: string[]) {
        if (!ids?.length) return
        const clean = ids.map((id) => String(id || '').trim()).filter(Boolean)
        if (!clean.length) return
        set((s) => {
            const next = new Set(s.dirtyTestIds)
            clean.forEach((id) => next.add(id))
            return { dirtyTestIds: next }
        })
    }

    function clearDirty(ids?: string[]) {
        if (!ids || !ids.length) {
            set({ dirtyTestIds: new Set() })
            return
        }
        const clean = ids.map((id) => String(id || '').trim()).filter(Boolean)
        if (!clean.length) return
        set((s) => {
            const next = new Set(s.dirtyTestIds)
            clean.forEach((id) => next.delete(id))
            return { dirtyTestIds: next }
        })
    }

    // ── Initial state ────────────────────────────────────────────────────────

    return {
        state: null,
        selectedId: null,
        focusStepId: null,
        dirtyTestIds: new Set(),
        loadError: null,
        hasUnsavedChanges: false,
        isSaving: false,
        saveError: null,
        _services: null,

        // ── Services ──────────────────────────────────────────────────────────

        setServices(svc) {
            set({ _services: svc })
        },

        // ── Lifecycle ─────────────────────────────────────────────────────────

        async load() {
            try {
                const loaded = await loadWorkspaceState()
                _revision = 0
                set({
                    state: loaded,
                    selectedId: loaded.root.id,
                    dirtyTestIds: new Set(),
                    hasUnsavedChanges: false,
                    saveError: null,
                    loadError: null,
                })
            } catch (error) {
                _revision = 0
                set({
                    state: null,
                    selectedId: null,
                    focusStepId: null,
                    dirtyTestIds: new Set(),
                    hasUnsavedChanges: false,
                    saveError: null,
                    loadError: error instanceof Error ? error.message : String(error),
                })
            }
        },

        async save() {
            const { state: snapshot, hasUnsavedChanges, saveError } = get()
            if (!snapshot) return false
            const hasPending = _saveTimer !== null
            if (!hasUnsavedChanges && !hasPending && !saveError) {
                await _saveQueue
                return true
            }
            cancelScheduledSave()
            await enqueueSave(snapshot, _revision)
            return true
        },

        // ── Selection ──────────────────────────────────────────────────────────

        select(id) {
            set({ selectedId: id, focusStepId: null })
        },

        openStep(testId, stepId) {
            set({ selectedId: testId, focusStepId: stepId })
        },

        mapAllTests() {
            return getAllTests(get().state)
        },

        getImportDestination() {
            const { state, selectedId } = get()
            return getImportDestinationQuery(state, selectedId, services().defaults.rootLabel)
        },

        getPublishSelection() {
            const { state, selectedId } = get()
            return getPublishSelectionQuery(state, selectedId, services().defaults.rootLabel)
        },

        // ── Workspace commands ────────────────────────────────────────────────

        async addFolder() {
            const { state: current, selectedId } = get()
            if (!current) return
            const result = addFolderFromSelection(current, selectedId, services().defaults.newFolder)
            await persistStateNow(result.nextState)
            if (result.selectedId) set({ selectedId: result.selectedId })
        },

        async addFolderAt(parentId) {
            const { state: current } = get()
            if (!current) return
            const result = addFolderAtCommand(current, parentId, services().defaults.newFolder)
            await persistStateNow(result.nextState)
            if (result.selectedId) set({ selectedId: result.selectedId })
        },

        async addTest() {
            const { state: current, selectedId } = get()
            if (!current) return
            const { defaults } = services()
            const result = addTestFromSelection(current, selectedId, defaults.newCase, defaults.firstStep)
            await persistStateNow(result.nextState, result.dirtyIds)
            if (result.selectedId) set({ selectedId: result.selectedId })
            if (result.focusStepId) set({ focusStepId: result.focusStepId })
        },

        async addTestAt(parentId) {
            const { state: current } = get()
            if (!current) return
            const { defaults } = services()
            const result = addTestAtCommand(current, parentId, defaults.newCase, defaults.firstStep)
            await persistStateNow(result.nextState, result.dirtyIds)
            if (result.selectedId) set({ selectedId: result.selectedId })
            if (result.focusStepId) set({ focusStepId: result.focusStepId })
        },

        async removeSelected() {
            const { state: current, selectedId } = get()
            if (!current) return
            const result = removeSelectedNode(current, selectedId)
            if (!result) return
            await persistStateNow(result.nextState, result.dirtyIds)
            if (result.selectedId !== undefined) set({ selectedId: result.selectedId })
            if (result.focusStepId !== undefined) set({ focusStepId: result.focusStepId })
        },

        async deleteNodeById(id) {
            const { state: current, selectedId } = get()
            if (!current) return
            const result = deleteNodeByIdCommand(current, id, selectedId)
            if (!result) return
            await persistStateNow(result.nextState, result.dirtyIds)
            if (result.selectedId !== undefined) set({ selectedId: result.selectedId })
            if (result.focusStepId !== undefined) set({ focusStepId: result.focusStepId })
        },

        async moveNode(nodeId, targetFolderId) {
            const { state: current } = get()
            if (!current) return false
            const result = moveWorkspaceNode(current, nodeId, targetFolderId)
            if (!result.moved) return false
            await persistStateNow(result.nextState)
            if (result.selectedId) set({ selectedId: result.selectedId })
            return true
        },

        renameNode(id, newName) {
            const { state: current } = get()
            if (!current) return
            const result = renameWorkspaceNode(current, id, newName)
            if (!result) return
            stageLocalState(result.nextState, result.dirtyIds)
        },

        updateTest(testId, patch) {
            const { state: current } = get()
            if (!current) return
            const result = updateTestCase(current, testId, patch)
            if (!result) return
            stageLocalState(result.nextState, result.dirtyIds)
        },

        async setNodeAlias(nodeId, alias) {
            const { state: current } = get()
            if (!current) return
            const result = setNodeAliasCommand(current, nodeId, alias)
            if (!result) return
            await persistStateNow(result.nextState, result.dirtyIds)
        },

        async setNodeIcon(nodeId, iconKey) {
            const { state: current } = get()
            if (!current) return
            const result = setNodeIconCommand(current, nodeId, iconKey)
            if (!result) return
            await persistStateNow(result.nextState, result.dirtyIds)
        },

        async addSharedStep(name, steps = []) {
            const { state: current } = get()
            if (!current) return null
            const result = addSharedStepCommand(current, name ?? services().defaults.sharedStep, steps)
            stageLocalState(result.nextState)
            return result.sharedId
        },

        async addSharedStepFromStep(step, name) {
            const { state: current } = get()
            if (!current) return null
            const result = addSharedStepFromStepCommand(current, step, services().defaults.sharedStep, name)
            stageLocalState(result.nextState)
            return result.sharedId
        },

        updateSharedStep(sharedId, patch) {
            const { state: current } = get()
            if (!current) return
            const result = updateSharedStepCommand(current, sharedId, patch)
            if (!result) return
            stageLocalState(result.nextState)
        },

        deleteSharedStep(sharedId) {
            const { state: current } = get()
            if (!current) return
            const result = deleteSharedStepCommand(current, sharedId)
            stageLocalState(result.nextState, result.dirtyIds)
        },

        insertSharedReference(testId, sharedId, afterIndex) {
            const { state: current } = get()
            if (!current) return
            const result = insertSharedReferenceCommand(current, testId, sharedId, afterIndex)
            if (!result) return
            stageLocalState(result.nextState, result.dirtyIds)
        },

        async resolveIncludedCases(decisions) {
            const { state: current } = get()
            if (!current || !Object.keys(decisions).length) return null
            const result = resolveIncludedCaseDecisions(current, decisions)
            stageLocalState(result.nextState, result.dirtyIds)
            return result
        },

        // ── Sync actions ──────────────────────────────────────────────────────

        async pull() {
            const { state: current, selectedId } = get()
            const result = await pullSelectedCase(current, selectedId, services().sync)
            if (result.status !== 'ok') return result
            await persistStateNow(result.nextState)
            return {
                status: result.status,
                testId: result.testId,
                externalId: result.externalId,
                nextState: result.nextState,
                includedCases: collectIncludedCaseCandidates(result.nextState, [result.testId]),
            }
        },

        async push() {
            cancelScheduledSave()
            await _saveQueue

            const { state: current, selectedId } = get()
            const result = await pushSelectedCaseUseCase(current, selectedId, services().sync, services().defaults.rootLabel)
            if (result.status !== 'ok') return result

            _revision++
            set({ state: result.nextState, hasUnsavedChanges: false, saveError: null })
            clearDirty(result.clearedDirtyIds)
            return result
        },

        async syncAll() {
            const { state: current } = get()
            if (!current) return { status: 'ok', count: 0 }
            const next = structuredClone(current)
            const tests = getAllTests(next)
            await services().sync.twoWaySync(next)
            await persistStateNow(next)
            clearDirty(tests.map((t) => t.id))
            return { status: 'ok', count: tests.length }
        },

        async previewZephyrImport(request) {
            const { state: current, selectedId } = get()
            return previewZephyrImportUseCase(current, selectedId, services().sync, services().defaults.rootLabel, request)
        },

        async applyZephyrImport(preview) {
            const { state: current } = get()
            const { nextState, result, clearedDirtyIds, changedTestIds } = await applyZephyrImportUseCase(current, preview, services().sync)
            await persistStateNow(nextState)
            clearDirty(clearedDirtyIds)
            return {
                ...result,
                nextState,
                includedCases: collectIncludedCaseCandidates(nextState, changedTestIds),
            }
        },

        async previewZephyrPublish() {
            const { state: current, selectedId } = get()
            return previewZephyrPublishUseCase(current, selectedId, services().sync, services().defaults.rootLabel)
        },

        async publishZephyr(preview) {
            cancelScheduledSave()
            await _saveQueue

            const { state: current } = get()
            const outcome = await publishZephyrPreviewUseCase(current, preview, services().sync)
            _revision++
            set({ state: outcome.nextState, hasUnsavedChanges: false, saveError: null })
            clearDirty(outcome.clearedDirtyIds)
            return { ...outcome.result, snapshotPath: outcome.snapshotPath, logPath: outcome.logPath }
        },
    }
})
