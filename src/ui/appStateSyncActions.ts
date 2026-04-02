import {
    applyZephyrImport as applyZephyrImportUseCase,
    previewZephyrImport as previewZephyrImportUseCase,
    previewZephyrPublish as previewZephyrPublishUseCase,
    publishZephyrPreview as publishZephyrPreviewUseCase,
    pullSelectedCase,
} from '@app/workspace'
import { type SyncService, type ZephyrImportPreview, type ZephyrImportRequest, type ZephyrPublishPreview, type ZephyrPublishResult } from '@app/sync'
import type { Folder, ID, RootState, TestCase } from '@core/domain'
import { isFolder, mapTests } from '@core/tree'

type Node = Folder | TestCase
type SyncAllResult = { status: 'ok'; count: number }

type AppStateSyncActionsOptions = {
    getCurrentState: () => RootState | null
    selectedId: ID | null
    sync: SyncService
    rootLabel: string
    getSelected: () => Node | null
    persistStateNow: (next: RootState, dirtyIds?: string[]) => Promise<void>
    clearDirty: (testIds?: string[]) => void
    cancelScheduledSave: () => void
    waitForPendingSaves: () => Promise<void>
    adoptStateSnapshot: (next: RootState) => number
    setHasUnsavedChanges: (value: boolean) => void
    setSaveError: (value: string | null) => void
}

export function createAppStateSyncActions({
    getCurrentState,
    selectedId,
    sync,
    rootLabel,
    getSelected,
    persistStateNow,
    clearDirty,
    cancelScheduledSave,
    waitForPendingSaves,
    adoptStateSnapshot,
    setHasUnsavedChanges,
    setSaveError,
}: AppStateSyncActionsOptions) {
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
        return previewZephyrImportUseCase(getCurrentState(), selectedId, sync, rootLabel, request)
    }

    async function applyZephyrImport(preview: ZephyrImportPreview) {
        const { nextState, result, clearedDirtyIds } = await applyZephyrImportUseCase(getCurrentState(), preview, sync)
        await persistStateNow(nextState)
        clearDirty(clearedDirtyIds)
        return result
    }

    async function previewZephyrPublish(): Promise<ZephyrPublishPreview> {
        return previewZephyrPublishUseCase(getCurrentState(), selectedId, sync, rootLabel)
    }

    async function publishZephyr(preview: ZephyrPublishPreview): Promise<ZephyrPublishResult & { snapshotPath: string; logPath: string }> {
        cancelScheduledSave()
        await waitForPendingSaves()

        const outcome = await publishZephyrPreviewUseCase(getCurrentState(), preview, sync)
        adoptStateSnapshot(outcome.nextState)
        clearDirty(outcome.clearedDirtyIds)
        setHasUnsavedChanges(false)
        setSaveError(null)

        return {
            ...outcome.result,
            snapshotPath: outcome.snapshotPath,
            logPath: outcome.logPath,
        }
    }

    return {
        pull,
        push,
        syncAll,
        previewZephyrImport,
        applyZephyrImport,
        previewZephyrPublish,
        publishZephyr,
    }
}
