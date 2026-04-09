import type { SyncService } from '@app/sync'
import type { RootState } from '@core/domain'
import type { ZephyrImportApplyResult, ZephyrImportPreview } from '@app/sync'

export async function applyZephyrImport(
    state: RootState | null,
    preview: ZephyrImportPreview,
    sync: SyncService
): Promise<{
    nextState: RootState
    result: ZephyrImportApplyResult
    clearedDirtyIds: string[]
    changedTestIds: string[]
}> {
    if (!state) throw new Error('State is not loaded yet')
    const nextState = structuredClone(state)
    const result = sync.applyZephyrImport(nextState, preview)

    return {
        nextState,
        result,
        clearedDirtyIds: [...new Set(
            preview.items
                .filter((item) => item.strategy === 'replace' && !item.replaceDisabled)
                .map((item) => item.localTestId ?? '')
                .filter(Boolean)
        )],
        changedTestIds: [...new Set([...(result.createdTestIds ?? []), ...(result.updatedTestIds ?? [])])],
    }
}
