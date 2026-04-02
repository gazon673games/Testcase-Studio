import { describe, expect, it } from 'vitest'
import { previewZephyrPublish } from './previewZephyrPublish'
import { makeSyncService, makeWorkspace } from './testSupport'

describe('workspace publish preview', () => {
    it('publishes only the selected test when a single test is selected', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        await previewZephyrPublish(state, folderTest.id, sync, 'Workspace')

        expect(sync.previewZephyrPublish).toHaveBeenCalledWith(state, [folderTest], folderTest.name)
    })

    it('uses the caller-facing root label when nothing is selected', async () => {
        const { state, rootTest, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        await previewZephyrPublish(state, null, sync, 'Workspace')

        expect(sync.previewZephyrPublish).toHaveBeenCalledWith(
            state,
            expect.arrayContaining([rootTest, folderTest]),
            'Workspace'
        )
    })
})
