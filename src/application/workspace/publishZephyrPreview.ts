import { nowISO, type RootState } from '@core/domain'
import { type SyncService, type ZephyrPublishPreview, type ZephyrPublishResult } from '@app/sync'
import { saveWorkspaceState, writeWorkspacePublishLog, writeWorkspaceSnapshot } from './store'

export async function publishZephyrPreview(
    state: RootState | null,
    preview: ZephyrPublishPreview,
    sync: SyncService
): Promise<{
    nextState: RootState
    result: ZephyrPublishResult
    snapshotPath: string
    logPath: string
    clearedDirtyIds: string[]
}> {
    if (!state) throw new Error('State is not loaded yet')
    const snapshotPath = await writeWorkspaceSnapshot(state, 'publish', {
        selectionLabel: preview.selectionLabel,
        generatedAt: preview.generatedAt,
        summary: preview.summary,
    })

    const nextState = structuredClone(state)
    const result = await sync.publishZephyrPreview(nextState, preview)
    await saveWorkspaceState(nextState)

    const logPath = await writeWorkspacePublishLog({
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

    return {
        nextState,
        result,
        snapshotPath,
        logPath,
        clearedDirtyIds: preview.items.map((item) => item.testId),
    }
}
