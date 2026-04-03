import { describe, expect, it } from 'vitest'
import { buildUpsertBodies } from './zephyrUpsertPayload'
import type { ProviderTest } from '../../types'

describe('buildUpsertBodies', () => {
    it('builds retry variants for Zephyr parameter variable types without defaultValue', () => {
        const payload: ProviderTest = {
            id: 'INSO-E01.01',
            name: 'Create insurance object',
            description: '',
            steps: [],
            attachments: [],
            extras: {
                projectKey: 'INSO',
                parameters: {
                    variables: [
                        { name: 'insuredId', type: 'string', defaultValue: '123' },
                        { name: 'policyId', defaultValue: '' },
                    ],
                    entries: [{ values: { insuredId: '123' } }],
                },
            },
        }

        const bodies = buildUpsertBodies(payload, true)
        expect(bodies).toHaveLength(3)

        expect(bodies[0]).toMatchObject({
            projectKey: 'INSO',
            parameters: {
                variables: [
                    { name: 'insuredId', type: 'TEXT' },
                    { name: 'policyId', type: 'TEXT' },
                ],
                entries: [{ values: { insuredId: '123' } }],
            },
        })

        expect(bodies[1]).toMatchObject({
            parameters: {
                variables: [
                    { name: 'insuredId', type: 'STRING' },
                    { name: 'policyId', type: 'STRING' },
                ],
            },
        })

        expect(bodies[2]).toMatchObject({
            parameters: {
                variables: [
                    { name: 'insuredId', type: 'string' },
                    { name: 'policyId', type: 'string' },
                ],
            },
        })

        bodies.forEach((body) => {
            const parameterJson = JSON.stringify((body as { parameters?: unknown }).parameters ?? {})
            expect(parameterJson).not.toContain('defaultValue')
        })
    })
})
