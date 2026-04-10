import { describe, expect, it } from 'vitest'
import { updateTestCase } from './commands'
import { makeWorkspace } from './testSupport'
import { findNode, isFolder } from '@core/tree'

describe('workspace test editing', () => {
    it('marks a test as dirty when meaningful local content changes', () => {
        const { state, rootTest } = makeWorkspace()

        const result = updateTestCase(state, rootTest.id, {
            description: 'Updated local description',
            details: {
                ...(rootTest.details ?? { tags: [], attributes: {} }),
                tags: ['critical'],
            },
        })

        const updated = findNode(result?.nextState.root ?? state.root, rootTest.id)

        expect(result?.dirtyIds).toEqual([rootTest.id])
        expect(updated && !isFolder(updated) ? updated.description : '').toBe('Updated local description')
        expect(updated && !isFolder(updated) ? updated.details?.tags : []).toEqual(['critical'])
    })

    it('can clear external links by replacing them with an empty list', () => {
        const { state, rootTest } = makeWorkspace()
        rootTest.links = [
            { provider: 'zephyr', externalId: 'PROJ-T1' },
            { provider: 'allure', externalId: 'AL-1' },
        ]

        const result = updateTestCase(state, rootTest.id, {
            links: [],
        })

        const updated = findNode(result?.nextState.root ?? state.root, rootTest.id)

        expect(result?.dirtyIds).toEqual([rootTest.id])
        expect(updated && !isFolder(updated) ? updated.links : []).toEqual([])
    })
})
