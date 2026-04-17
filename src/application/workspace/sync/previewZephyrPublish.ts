import type { RootState } from '@core/domain'
import { type SyncService, type ZephyrPublishPreview } from '@app/sync'
import { getPublishSelection } from '../core/queries'

export async function previewZephyrPublish(
    state: RootState | null,
    selectedId: string | null,
    sync: SyncService,
    rootLabel: string
): Promise<ZephyrPublishPreview> {
    if (!state) throw new Error('State is not loaded yet')
    const selection = getPublishSelection(state, selectedId, rootLabel)
    return sync.previewZephyrPublish(state, selection.tests, selection.label)
}
