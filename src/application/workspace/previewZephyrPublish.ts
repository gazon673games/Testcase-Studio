import type { RootState } from '@core/domain'
import { SyncEngine, type ZephyrPublishPreview } from '@app/sync'
import { getPublishSelection } from './queries'

export async function previewZephyrPublish(
    state: RootState | null,
    selectedId: string | null,
    sync: SyncEngine,
    rootLabel: string
): Promise<ZephyrPublishPreview> {
    if (!state) throw new Error('State is not loaded yet')
    const selection = getPublishSelection(state, selectedId, rootLabel)
    return sync.previewZephyrPublish(state, selection.tests, selection.label)
}
