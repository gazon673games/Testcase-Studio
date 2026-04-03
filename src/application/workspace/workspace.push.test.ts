import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeMocks = vi.hoisted(() => ({
    saveWorkspaceState: vi.fn(async () => {}),
    writeWorkspaceSnapshot: vi.fn(async () => '/tmp/workspace-snapshot.json'),
    writeWorkspacePublishLog: vi.fn(async () => '/tmp/workspace-publish-log.json'),
}))

vi.mock('./store', () => ({
    saveWorkspaceState: storeMocks.saveWorkspaceState,
    writeWorkspaceSnapshot: storeMocks.writeWorkspaceSnapshot,
    writeWorkspacePublishLog: storeMocks.writeWorkspacePublishLog,
}))

import { pushSelectedCase } from './pushSelectedCase'
import { makePublishResult, makeSyncService, makeWorkspace } from './testSupport'
import type { ZephyrPublishPreviewItem } from '@app/sync'

describe('workspace push selected case', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns not-a-test when a folder is selected', async () => {
        const { state, childFolder } = makeWorkspace()
        const sync = makeSyncService()

        const result = await pushSelectedCase(state, childFolder.id, sync, 'Workspace')

        expect(result).toEqual({ status: 'not-a-test' })
    })

    it('publishes only the selected case through the publish pipeline', async () => {
        const { state, folderTest } = makeWorkspace()
        folderTest.links = [{ provider: 'zephyr', externalId: 'PROJ-T77' }]

        const sync = makeSyncService({
            publishZephyrPreview: vi.fn(async (_nextState, preview) =>
                makePublishResult(
                    preview.items.map((item: ZephyrPublishPreviewItem) => ({
                        testId: item.testId,
                        testName: item.testName,
                        status: 'updated',
                    }))
                )
            ),
        })

        const result = await pushSelectedCase(state, folderTest.id, sync, 'Workspace')

        expect(result.status).toBe('ok')
        if (result.status !== 'ok') throw new Error('Expected ok result')

        expect(result.result.updated).toBe(1)
        expect(result.result.failed).toBe(0)
        expect(result.clearedDirtyIds).toEqual([folderTest.id])
        expect(storeMocks.writeWorkspaceSnapshot).toHaveBeenCalled()
        expect(storeMocks.writeWorkspacePublishLog).toHaveBeenCalled()
        expect(storeMocks.saveWorkspaceState).toHaveBeenCalled()
    })
})
