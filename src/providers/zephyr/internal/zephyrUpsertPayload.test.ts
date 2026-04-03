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

    it('normalizes mixed html step text into br tags in the final request body', () => {
        const payload: ProviderTest = {
            id: 'INSO-E01.01',
            name: 'Create insurance object',
            description: '',
            steps: [
                {
                    action: '<strong>Предварительные условия</strong><br />1. Получен токен авторизации\ndsfds',
                    data: '',
                    expected: '',
                    text: '<strong>Предварительные условия</strong><br />1. Получен токен авторизации\ndsfds',
                },
            ],
            attachments: [],
            extras: {
                projectKey: 'INSO',
            },
        }

        const [body] = buildUpsertBodies(payload, true)
        const steps = (body as { testScript?: { steps?: Array<{ description?: string }> } }).testScript?.steps ?? []

        expect(steps[0]?.description).toBe('<strong>Предварительные условия</strong><br />1. Получен токен авторизации<br />dsfds')
    })
})
