import {
    applyZephyrImport as applyZephyrImportUseCase,
    pushSelectedCase as pushSelectedCaseUseCase,
    previewZephyrImport as previewZephyrImportUseCase,
    previewZephyrPublish as previewZephyrPublishUseCase,
    publishZephyrPreview as publishZephyrPreviewUseCase,
    pullSelectedCase,
} from '@app/workspace'
import { type SyncService, type ZephyrImportPreview, type ZephyrImportRequest, type ZephyrPublishPreview, type ZephyrPublishResult } from '@app/sync'
import type { ID, RootState } from '@core/domain'
import { mapTests } from '@core/tree'
type SyncAllResult = { status: 'ok'; count: number }

type AppStateSyncActionsOptions = {
    getCurrentState: () => RootState | null
    selectedId: ID | null
    sync: SyncService
    rootLabel: string
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
        cancelScheduledSave()
        await waitForPendingSaves()

        const result = await pushSelectedCaseUseCase(getCurrentState(), selectedId, sync, rootLabel)
        if (result.status !== 'ok') return result

        adoptStateSnapshot(result.nextState)
        clearDirty(result.clearedDirtyIds)
        setHasUnsavedChanges(false)
        setSaveError(null)

        return result
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
