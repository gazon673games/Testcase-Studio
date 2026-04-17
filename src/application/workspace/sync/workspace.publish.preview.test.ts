import { describe, expect, it } from 'vitest'
import { previewZephyrPublish } from './previewZephyrPublish'
import { makeSyncService, makeWorkspace } from '../testSupport'

describe('workspace publish preview', () => {
    it('publishes only the selected test when a single test is selected', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const preview = await previewZephyrPublish(state, folderTest.id, sync, 'Workspace')

        expect(preview.selectionLabel).toBe(folderTest.name)
        expect(preview.items.map((item) => item.testId)).toEqual([folderTest.id])
    })

    it('uses the caller-facing root label when nothing is selected', async () => {
        const { state, rootTest, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const preview = await previewZephyrPublish(state, null, sync, 'Workspace')

        expect(preview.selectionLabel).toBe('Workspace')
        expect(preview.items.map((item) => item.testId)).toEqual(expect.arrayContaining([rootTest.id, folderTest.id]))
    })
})
