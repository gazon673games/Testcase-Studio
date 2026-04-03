import type { RootState } from '@core/domain'
import { isFolder } from '@core/tree'
import { type SyncService, type ZephyrPublishResult } from '@app/sync'
import { getSelectedNode } from './queries'
import { previewZephyrPublish } from './previewZephyrPublish'
import { publishZephyrPreview } from './publishZephyrPreview'

export type PushSelectedCaseResult =
    | { status: 'no-selection' | 'not-a-test' }
    | ({
          status: 'ok'
          result: ZephyrPublishResult
          snapshotPath: string
          logPath: string
          nextState: RootState
          clearedDirtyIds: string[]
      })

export async function pushSelectedCase(
    state: RootState | null,
    selectedId: string | null,
    sync: SyncService,
    rootLabel: string
): Promise<PushSelectedCaseResult> {
    const node = getSelectedNode(state, selectedId)
    if (!state || !node) return { status: 'no-selection' }
    if (isFolder(node)) return { status: 'not-a-test' }

    const preview = await previewZephyrPublish(state, selectedId, sync, rootLabel)
    const outcome = await publishZephyrPreview(state, preview, sync)

    return {
        status: 'ok',
        ...outcome,
    }
}
