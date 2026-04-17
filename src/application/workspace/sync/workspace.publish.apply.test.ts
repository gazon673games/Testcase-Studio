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

import { publishZephyrPreview } from './publishZephyrPreview'
import { makePublishItem, makePublishPreview, makePublishResult, makeSyncService, makeWorkspace } from '../testSupport'

describe('workspace publish apply', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('clears dirty only for tests that were successfully published', async () => {
        const { state, rootTest, folderTest } = makeWorkspace()
        const preview = makePublishPreview('Workspace', [
            makePublishItem({
                id: 'published-item',
                testId: rootTest.id,
                testName: rootTest.name,
                status: 'update',
                publish: true,
                externalId: 'PROJ-T10',
            }),
            makePublishItem({
                id: 'skipped-item',
                testId: folderTest.id,
                testName: folderTest.name,
                status: 'skip',
                publish: false,
                externalId: 'PROJ-T11',
            }),
            makePublishItem({
                id: 'blocked-item',
                testId: 'test-blocked',
                testName: 'Blocked case',
                status: 'blocked',
                publish: false,
            }),
        ])
        const sync = makeSyncService({
            publishZephyrPreview: vi.fn(async () =>
                makePublishResult([
                    { testId: rootTest.id, testName: rootTest.name, status: 'updated' },
                    { testId: folderTest.id, testName: folderTest.name, status: 'skipped' },
                    { testId: 'test-blocked', testName: 'Blocked case', status: 'blocked' },
                ])
            ),
        })

        const result = await publishZephyrPreview(state, preview, sync)

        expect(result.clearedDirtyIds).toEqual([rootTest.id])
        expect(storeMocks.writeWorkspaceSnapshot).toHaveBeenCalled()
        expect(storeMocks.writeWorkspacePublishLog).toHaveBeenCalled()
    })
})
