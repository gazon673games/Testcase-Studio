import { describe, expect, it, vi } from 'vitest'
import type { TestCase } from '@core/domain'
import { pullSelectedCase } from './pullSelectedCase'
import { makeProviderTest, makeSyncService, makeWorkspace } from './testSupport'

describe('workspace pull selected case', () => {
    it('returns no-link when the selected test has no external references', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const result = await pullSelectedCase(state, folderTest.id, sync)

        expect(result).toEqual({ status: 'no-link' })
    })

    it('prefers the Zephyr link over fallback providers', async () => {
        const { state } = makeWorkspace()
        const selectedTest = ((state.root.children[1] as typeof state.root).children[0] as TestCase)
        selectedTest.links = [
            { provider: 'allure', externalId: 'AL-7' },
            { provider: 'zephyr', externalId: 'PROJ-T77' },
        ]

        const sync = makeSyncService({
            pullByLink: vi.fn(async () =>
                makeProviderTest({
                    id: 'PROJ-T77',
                    name: 'Remote folder test',
                    description: 'Pulled from Zephyr',
                })
            ),
        })

        const result = await pullSelectedCase(state, selectedTest.id, sync)

        expect(sync.pullByLink).toHaveBeenCalledWith({ provider: 'zephyr', externalId: 'PROJ-T77' })
        expect(result).toMatchObject({ status: 'ok', externalId: 'PROJ-T77' })
    })
})
