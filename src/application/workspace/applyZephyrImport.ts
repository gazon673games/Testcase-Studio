import { SyncEngine } from '@core/syncEngine'
import type { RootState } from '@core/domain'
import type { ZephyrImportApplyResult, ZephyrImportPreview } from '@core/zephyrImport'

export async function applyZephyrImport(
    state: RootState | null,
    preview: ZephyrImportPreview,
    sync: SyncEngine
): Promise<{
    nextState: RootState
    result: ZephyrImportApplyResult
    clearedDirtyIds: string[]
}> {
    if (!state) throw new Error('State is not loaded yet')
    const nextState = structuredClone(state)
    const result = sync.applyZephyrImport(nextState, preview)
    return {
        nextState,
        result,
        clearedDirtyIds: preview.items.map((item) => item.localTestId ?? '').filter(Boolean),
    }
}
