import { describe, expect, it } from 'vitest'
import { mkFolder, mkTest, type RootState } from '@core/domain'
import { buildAppShellViewState } from './appShellViewState'

function makeAppState(selectedId: string) {
    const test = mkTest('Local test')
    test.id = 'test-1'
    test.links = []
    test.meta = { ...(test.meta ?? { tags: [], params: {} }), params: { projectKey: 'PROJ' }, tags: [] }

    const root = mkFolder('Root', [test])
    root.id = 'root'

    const state: RootState = {
        root,
        sharedSteps: [],
    }

    return {
        state,
        selectedId,
        mapAllTests: () => [test],
        getImportDestination: () => ({ id: root.id, label: 'Root' }),
        getPublishSelection: () => ({ label: 'Local test', tests: [test] }),
    }
}

describe('buildAppShellViewState', () => {
    it('allows pushing a selected local test without Zephyr link', () => {
        const app = makeAppState('test-1') as any
        const viewState = buildAppShellViewState(app, ((key: string) => key) as any, 'Root')

        expect(viewState?.canPush).toBe(true)
        expect(viewState?.canPull).toBe(true)
    })
})
