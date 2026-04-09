import { describe, expect, it } from 'vitest'
import { buildZephyrPublishPayload, buildZephyrPublishPreview, createSyncText } from '@app/sync'
import { mkFolder, mkStep, mkTest, type RootState } from './domain'
import type { ProviderTest } from '@providers/types'

const syncText = createSyncText((key) => key)

describe('buildZephyrPublishPreview', () => {
    it('plans upload and delete operations for case and step attachments', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T1' }]
        test.attachments = [{ id: 'local-top', name: 'case-proof.png', pathOrDataUrl: '/tmp/case-proof.png' }]

        const step = mkStep('Action', '', '')
        step.attachments = [{ id: 'local-step', name: 'step-proof.png', pathOrDataUrl: '/tmp/step-proof.png' }]
        test.steps = [step]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const remote: ProviderTest = {
            id: 'PROJ-T1',
            name: 'Publish case',
            description: '',
            steps: [{ action: 'Action', data: '', expected: '', text: 'Action', attachments: [] }],
            attachments: [{ id: 'remote-old', name: 'old-proof.png', pathOrDataUrl: 'https://example.test/old-proof.png' }],
            updatedAt: '2026-03-27T00:00:00.000Z',
            extras: {},
        }

        const preview = buildZephyrPublishPreview(state, [test], new Map([['PROJ-T1', remote]]), 'Current case', syncText)
        const [item] = preview.items

        expect(item.attachmentsToUpload.map((attachment) => attachment.name)).toEqual(['case-proof.png', 'step-proof.png'])
        expect(item.attachmentIdsToDelete).toEqual(['remote-old'])
    })

    it('round-trips required custom fields and Zephyr parameters from meta.params', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T6170' }]
        test.meta = {
            ...(test.meta ?? { tags: [], params: {} }),
            params: {
                ...(test.meta?.params ?? {}),
                key: 'PROJ-T6170',
                projectKey: 'PROJ',
                folder: '/CORE/Publish',
                'customFields.Test Type': 'Manual',
                'customFields.Automation': 'Not Automated',
                'parameters.variables': JSON.stringify([{ name: 'insuredId', type: 'string' }]),
                'parameters.entries': JSON.stringify([{ values: { insuredId: '123' } }]),
            },
        }
        test.steps = [mkStep('Action', '', 'Expected')]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const payload = buildZephyrPublishPayload(test, state)

        expect(payload.extras?.customFields).toEqual({
            Automation: 'Not Automated',
            'Test Type': 'Manual',
        })
        expect(payload.extras?.parameters).toEqual({
            variables: [{ name: 'insuredId', type: 'string', defaultValue: '' }],
            entries: [{ values: { insuredId: '123' } }],
        })
    })

    it('maps dedicated meta fields to Zephyr custom fields when explicit params are absent', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.meta = {
            ...(test.meta ?? { tags: [], params: {} }),
            automation: 'Automated',
            testType: 'Regression',
            assignedTo: 'user-1',
            params: {
                ...(test.meta?.params ?? {}),
                projectKey: 'PROJ',
            },
        }
        test.steps = [mkStep('Action', '', 'Expected')]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const payload = buildZephyrPublishPayload(test, state)

        expect(payload.extras?.customFields).toEqual({
            Automation: 'Automated',
            'Assigned to': 'user-1',
            'Test Type': 'Regression',
        })
    })

    it('shows custom field differences in publish preview', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T6170' }]
        test.meta = {
            ...(test.meta ?? { tags: [], params: {} }),
            params: {
                ...(test.meta?.params ?? {}),
                key: 'PROJ-T6170',
                projectKey: 'PROJ',
                'customFields.Test Type': 'Manual',
                'customFields.Automation': 'Not Automated',
            },
        }
        test.steps = [mkStep('Action', '', 'Expected')]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const remote: ProviderTest = {
            id: 'PROJ-T6170',
            name: 'Publish case',
            description: '',
            steps: [{ action: 'Action', data: '', expected: 'Expected', text: 'Action', attachments: [] }],
            attachments: [],
            updatedAt: '2026-03-27T00:00:00.000Z',
            extras: {
                projectKey: 'PROJ',
                customFields: {
                    Automation: 'Automated',
                    'Test Type': 'Automated',
                },
            },
        }

        const preview = buildZephyrPublishPreview(state, [test], new Map([['PROJ-T6170', remote]]), 'Current case', syncText)
        const [item] = preview.items

        expect(item.diffs.some((diff) => diff.field === 'customFields')).toBe(true)
    })

    it('does not auto-define Zephyr variables from step text', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T6170' }]
        test.meta = {
            ...(test.meta ?? { tags: [], params: {} }),
            params: {
                ...(test.meta?.params ?? {}),
                key: 'PROJ-T6170',
                projectKey: 'PROJ',
                'parameters.variables': '[]',
                'parameters.entries': '[]',
            },
        }
        test.steps = [
            mkStep(
                'POST {{objectId}} with {{$guid}}',
                'Use {ms-insurance-contract-object}',
                'Expect {id} back'
            ),
        ]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const payload = buildZephyrPublishPayload(test, state)

        expect(payload.extras?.parameters).toBeUndefined()
    })

    it('keeps exported action parts on separate html lines for Zephyr', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T6170' }]
        const step = mkStep('<strong>Предварительные условия</strong><br />1. Получен токен авторизации', '', '')
        step.internal!.parts!.action = [{ id: 'part-note', text: 'dsfds' }]
        test.steps = [step]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const payload = buildZephyrPublishPayload(test, state)

        expect(payload.steps[0]?.action).toBe('<strong>Предварительные условия</strong><br />1. Получен токен авторизации<br />dsfds')
    })

    it('does not add parameter diffs when local test has no explicit Zephyr parameters', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T6170' }]
        test.steps = [mkStep('POST {{objectId}} with {{$guid}}', '', 'Expect {id} back')]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const remote: ProviderTest = {
            id: 'PROJ-T6170',
            name: 'Publish case',
            description: '',
            steps: [{ action: 'POST {{objectId}} with {{$guid}}', data: '', expected: 'Expect {id} back', text: 'POST {{objectId}} with {{$guid}}', attachments: [] }],
            attachments: [],
            updatedAt: '2026-03-27T00:00:00.000Z',
            extras: {
                projectKey: 'PROJ',
                parameters: { variables: [], entries: [] },
            },
        }

        const preview = buildZephyrPublishPreview(state, [test], new Map([['PROJ-T6170', remote]]), 'Current case', syncText)
        const [item] = preview.items

        expect(item.diffs.some((diff) => diff.field === 'parameters')).toBe(false)
        expect(item.payload.extras?.parameters).toBeUndefined()
    })
})
