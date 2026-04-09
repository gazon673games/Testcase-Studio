import { describe, expect, it, vi } from 'vitest'
import { applyZephyrImport } from './applyZephyrImport'
import { makeImportItem, makeImportPreview, makeSyncService, makeWorkspace } from './testSupport'

describe('workspace import apply', () => {
    it('clears dirty only for tests that were actually updated or created locally', async () => {
        const { state, rootTest, folderTest } = makeWorkspace()
        const preview = makeImportPreview(
            {
                mode: 'keys',
                destinationFolderId: 'folder-billing',
                refs: ['PROJ-T1', 'PROJ-T2', 'PROJ-T3'],
            },
            [
                makeImportItem({
                    id: 'update-item',
                    localTestId: rootTest.id,
                    status: 'update',
                    strategy: 'replace',
                }),
                makeImportItem({
                    id: 'draft-item',
                    localTestId: folderTest.id,
                    status: 'conflict',
                    strategy: 'merge-locally-later',
                }),
                makeImportItem({
                    id: 'skip-item',
                    localTestId: 'test-skipped',
                    status: 'conflict',
                    strategy: 'skip',
                }),
            ]
        )
        const sync = makeSyncService({
            applyZephyrImport: vi.fn(() => ({
                created: 0,
                createdTestIds: [],
                updated: 1,
                updatedTestIds: [rootTest.id],
                skipped: 1,
                drafts: 1,
                unchanged: 0,
            })),
        })

        const result = await applyZephyrImport(state, preview, sync)

        expect(result.clearedDirtyIds).toEqual([rootTest.id])
    })
})
