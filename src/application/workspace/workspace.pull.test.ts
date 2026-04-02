import { describe, expect, it, vi } from 'vitest'
import { pullSelectedCase } from './pullSelectedCase'
import { makeProviderTest, makeSyncService, makeWorkspace } from './testSupport'
import { findNode, isFolder } from '@core/tree'

describe('workspace pull selected case', () => {
    it('returns no-link when the selected test has no external references', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const result = await pullSelectedCase(state, folderTest.id, sync)

        expect(result).toEqual({ status: 'no-link' })
    })

    it('prefers the Zephyr link over fallback providers', async () => {
        const { state, folderTest } = makeWorkspace()
        const selected = findNode(state.root, folderTest.id)
        if (!selected || isFolder(selected)) throw new Error('Expected a test node in the workspace state')

        selected.links = [
            { provider: 'allure', externalId: 'AL-7' },
            { provider: 'zephyr', externalId: 'PROJ-T77' },
        ]

        const sync = makeSyncService({
            pullByLink: vi.fn(async (link) =>
                makeProviderTest({
                    id: link.externalId,
                    name: link.provider === 'zephyr' ? 'Remote folder test from Zephyr' : 'Remote fallback test',
                    description: link.provider === 'zephyr' ? 'Pulled from Zephyr' : 'Pulled from fallback',
                })
            ),
        })

        const result = await pullSelectedCase(state, folderTest.id, sync)

        expect(result).toMatchObject({ status: 'ok', externalId: 'PROJ-T77' })
        if (result.status !== 'ok') throw new Error('Expected ok result')

        const updated = findNode(result.nextState.root, folderTest.id)
        expect(updated && !isFolder(updated) ? updated.name : '').toBe('Remote folder test from Zephyr')
        expect(updated && !isFolder(updated) ? updated.description : '').toBe('Pulled from Zephyr')
    })
})
