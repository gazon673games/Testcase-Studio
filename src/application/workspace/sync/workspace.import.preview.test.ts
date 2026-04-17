import { describe, expect, it } from 'vitest'
import { previewZephyrImport } from './previewZephyrImport'
import { makeSyncService, makeWorkspace } from '../testSupport'

describe('workspace import preview', () => {
    it('chooses the parent folder when a test is selected', async () => {
        const { state, childFolder, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const preview = await previewZephyrImport(state, folderTest.id, sync, 'Workspace', {
            mode: 'project',
            projectKey: 'PROJ',
        })

        expect(preview.destinationFolderId).toBe(childFolder.id)
        expect(preview.request).toMatchObject({
            mode: 'project',
            projectKey: 'PROJ',
            destinationFolderId: childFolder.id,
        })
    })

    it('respects an explicit destination folder override', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const preview = await previewZephyrImport(state, folderTest.id, sync, 'Workspace', {
            mode: 'project',
            projectKey: 'PROJ',
            destinationFolderId: 'folder-override',
        })

        expect(preview.destinationFolderId).toBe('folder-override')
        expect(preview.request.destinationFolderId).toBe('folder-override')
    })
})
