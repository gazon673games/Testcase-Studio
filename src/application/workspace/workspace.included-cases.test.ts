import { describe, expect, it } from 'vitest'
import { findNode, findParentFolder, isFolder } from '@core/tree'
import { collectIncludedCaseCandidates, resolveIncludedCaseDecisions } from './includedCases'
import { makeWorkspace } from './testSupport'

describe('workspace included Zephyr cases', () => {
    it('collects nested testcase references from pulled/imported steps', () => {
        const { state, folderTest } = makeWorkspace()
        const host = findNode(state.root, folderTest.id)
        if (!host || isFolder(host)) throw new Error('Expected host test')

        host.steps = [
            {
                ...host.steps[0],
                raw: { ...(host.steps[0]?.raw ?? {}), testCaseKey: 'PROD-T9701' },
                internal: {
                    ...(host.steps[0]?.internal ?? {}),
                    meta: {
                        zephyrIncludedTestKey: 'PROD-T9701',
                        zephyrIncludedTestName: 'Nested case',
                        zephyrIncludedTestSnapshot: {
                            id: 'PROD-T9701',
                            name: 'Nested case',
                            description: '',
                            steps: [
                                { action: 'Nested action', data: '', expected: 'Nested expected', text: 'Nested action' },
                            ],
                            attachments: [],
                        },
                    },
                },
            },
        ]

        const candidates = collectIncludedCaseCandidates(state, [folderTest.id])

        expect(candidates).toHaveLength(1)
        expect(candidates[0]).toMatchObject({
            hostTestId: folderTest.id,
            includedTestKey: 'PROD-T9701',
            includedTestName: 'Nested case',
            includedStepsCount: 1,
        })
        })

    it('can inline included testcase steps into the parent case', () => {
        const { state, folderTest } = makeWorkspace()
        const host = findNode(state.root, folderTest.id)
        if (!host || isFolder(host)) throw new Error('Expected host test')

        host.steps = [
            {
                ...host.steps[0],
                raw: { ...(host.steps[0]?.raw ?? {}), testCaseKey: 'PROD-T9701' },
                action: 'Included placeholder',
                text: 'Included placeholder',
                internal: {
                    ...(host.steps[0]?.internal ?? {}),
                    meta: {
                        zephyrIncludedTestKey: 'PROD-T9701',
                        zephyrIncludedTestName: 'Nested case',
                        zephyrIncludedTestSnapshot: {
                            id: 'PROD-T9701',
                            name: 'Nested case',
                            description: '',
                            steps: [
                                { action: 'Nested step 1', data: '', expected: 'Done 1', text: 'Nested step 1' },
                                { action: 'Nested step 2', data: 'Payload', expected: 'Done 2', text: 'Nested step 2' },
                            ],
                            attachments: [],
                        },
                    },
                },
            },
        ]

        const [candidate] = collectIncludedCaseCandidates(state, [folderTest.id])
        const result = resolveIncludedCaseDecisions(state, { [candidate.id]: 'inline' })
        const updated = findNode(result.nextState.root, folderTest.id)

        if (!updated || isFolder(updated)) throw new Error('Expected updated test')

        expect(updated.steps.map((step) => step.action)).toEqual(['Nested step 1', 'Nested step 2'])
        expect(updated.steps.every((step) => !step.raw?.testCaseKey)).toBe(true)
    })

    it('can create a sibling local case from an included testcase snapshot', () => {
        const { state, folderTest } = makeWorkspace()
        const host = findNode(state.root, folderTest.id)
        if (!host || isFolder(host)) throw new Error('Expected host test')

        host.steps = [
            {
                ...host.steps[0],
                raw: { ...(host.steps[0]?.raw ?? {}), testCaseKey: 'PROD-T9701' },
                internal: {
                    ...(host.steps[0]?.internal ?? {}),
                    meta: {
                        zephyrIncludedTestKey: 'PROD-T9701',
                        zephyrIncludedTestName: 'Nested case',
                        zephyrIncludedTestSnapshot: {
                            id: 'PROD-T9701',
                            name: 'Nested case',
                            description: 'Imported nested case',
                            steps: [
                                { action: 'Nested step 1', data: '', expected: 'Done 1', text: 'Nested step 1' },
                            ],
                            attachments: [],
                            extras: { key: 'PROD-T9701' },
                        },
                    },
                },
            },
        ]

        const [candidate] = collectIncludedCaseCandidates(state, [folderTest.id])
        const result = resolveIncludedCaseDecisions(state, { [candidate.id]: 'create-local-case' })
        const parent = findParentFolder(result.nextState.root, folderTest.id)
        if (!parent) throw new Error('Expected parent folder')

        const includedFolder = parent.children.find((child) => isFolder(child) && child.name === `INCLUDED - ${folderTest.name}`)
        if (!includedFolder || !isFolder(includedFolder)) throw new Error('Expected included folder')

        const created = includedFolder.children.find((child) => !isFolder(child))
        if (!created || isFolder(created)) throw new Error('Expected created local case')

        expect(created.name).toBe('Nested case')
        expect(created.links.find((link) => link.provider === 'zephyr')?.externalId).toBe('PROD-T9701')
        expect(result.createdTestIds).toEqual([created.id])

        const updated = findNode(result.nextState.root, folderTest.id)
        if (!updated || isFolder(updated)) throw new Error('Expected updated host case')
        expect(updated.steps).toHaveLength(1)
        expect(updated.steps[0]?.action).toBe(`[[id:${created.id}#${created.steps[0]!.id}.action]]`)
        expect(updated.steps[0]?.expected).toBe(`[[id:${created.id}#${created.steps[0]!.id}.expected]]`)
        expect(updated.steps[0]?.internal?.meta?.zephyrIncludedLocalTestId).toBe(created.id)
    })
})
