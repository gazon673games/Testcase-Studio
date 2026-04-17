import { describe, expect, it } from 'vitest'
import { addSharedStep, addSharedStepFromStep, deleteSharedStep, insertSharedReference, updateSharedStep } from './commands'
import { mkStep } from '@core/domain'
import { findNode, isFolder } from '@core/tree'
import { makeWorkspace } from '../testSupport'

describe('workspace shared step management', () => {
    it('creates a visible shared step immediately and gives it at least one step', () => {
        const { state } = makeWorkspace()

        const result = addSharedStep(state, 'Login flow')

        expect(result.nextState.sharedSteps).toHaveLength(1)
        expect(result.sharedId).toBe(result.nextState.sharedSteps[0]?.id)
        expect(result.nextState.sharedSteps[0]?.steps.length).toBeGreaterThan(0)
    })

    it('can derive a shared step from an existing step using the step text as the default name', () => {
        const { state, rootTest } = makeWorkspace()
        const sourceStep = rootTest.steps[0]
        sourceStep.action = 'Open invoice screen'

        const result = addSharedStepFromStep(state, sourceStep, 'Fallback name')

        expect(result.nextState.sharedSteps[0]?.name).toBe('Open invoice screen')
        expect(result.nextState.sharedSteps[0]?.steps[0]).toMatchObject({
            action: sourceStep.action,
            data: sourceStep.data,
            expected: sourceStep.expected,
        })
    })

    it('updates shared step name and steps', () => {
        const { state } = makeWorkspace()
        const created = addSharedStep(state, 'Login flow')
        const replacementStep = mkStep('Type credentials', '', 'Signed in')

        const result = updateSharedStep(created.nextState, created.sharedId, {
            name: 'Updated login flow',
            steps: [replacementStep],
        })

        expect(result?.nextState.sharedSteps[0]?.name).toBe('Updated login flow')
        expect(result?.nextState.sharedSteps[0]?.steps).toEqual([replacementStep])
    })

    it('removes a shared step and dirties only tests that actually referenced it', () => {
        const { state, rootTest, folderTest } = makeWorkspace()
        const shared = addSharedStep(state, 'Reusable login')
        const sharedStateRootTest = findNode(shared.nextState.root, rootTest.id)
        if (sharedStateRootTest && !isFolder(sharedStateRootTest)) {
            sharedStateRootTest.steps[0].usesShared = shared.sharedId
        }

        const result = deleteSharedStep(shared.nextState, shared.sharedId)
        const nextRootTest = findNode(result.nextState.root, rootTest.id)
        const nextFolderTest = findNode(result.nextState.root, folderTest.id)

        expect(result.nextState.sharedSteps).toHaveLength(0)
        expect(result.dirtyIds).toEqual([rootTest.id])
        expect(nextRootTest && !isFolder(nextRootTest) ? nextRootTest.steps.some((step) => step.usesShared === shared.sharedId) : true).toBe(false)
        expect(nextFolderTest && !isFolder(nextFolderTest) ? nextFolderTest.steps.length : 0).toBe(folderTest.steps.length)
    })

    it('inserts a shared reference into the owning test and marks that test dirty', () => {
        const { state, rootTest } = makeWorkspace()
        const shared = addSharedStep(state, 'Reusable login')

        const result = insertSharedReference(shared.nextState, rootTest.id, shared.sharedId, 0)
        const updated = findNode(result?.nextState.root ?? state.root, rootTest.id)

        expect(result?.dirtyIds).toEqual([rootTest.id])
        expect(updated && !isFolder(updated) ? updated.steps[1]?.usesShared : undefined).toBe(shared.sharedId)
    })
})
