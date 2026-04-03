import { describe, expect, it } from 'vitest'
import { ZephyrHttpProvider, ZephyrUpsertError, type ZephyrApiClient } from './zephyr.http'
import type { ProviderTest } from '../types'

describe('ZephyrHttpProvider.upsertTest', () => {
    it('captures request and response details for every failed upsert attempt', async () => {
        let attemptNumber = 0
        const client: ZephyrApiClient = {
            zephyrGetTestCase: async <T = unknown>() => ({} as T),
            zephyrSearchTestCases: async <T = unknown>() => ({} as T),
            zephyrUpsertTestCase: async (body: unknown) => {
                attemptNumber += 1
                const error = new Error(`Zephyr(upsert) 400 - ${JSON.stringify(body)}`) as Error & {
                    request?: { method: string; url: string; body: unknown }
                    response?: { status: number; statusText: string; body: string }
                }
                error.request = {
                    method: 'PUT',
                    url: `https://zephyr.test/rest/atm/1.0/testcase/PROD-T6170?attempt=${attemptNumber}`,
                    body,
                }
                error.response = {
                    status: 400,
                    statusText: 'Bad Request',
                    body: '{"errorMessages":["The field parameters.variables.type is required."]}',
                }
                throw error
            },
            zephyrUploadAttachment: async () => undefined,
            zephyrDeleteAttachment: async () => undefined,
        }

        const provider = new ZephyrHttpProvider(client)
        const payload: ProviderTest = {
            id: 'PROD-T6170',
            name: 'Test',
            description: '',
            steps: [],
            attachments: [],
            extras: {
                projectKey: 'PROD',
                parameters: {
                    variables: [{ name: 'insuredId', type: 'string', defaultValue: '' }],
                },
            },
        }

        await expect(provider.upsertTest(payload)).rejects.toBeInstanceOf(ZephyrUpsertError)

        try {
            await provider.upsertTest(payload)
        } catch (error) {
            expect(error).toBeInstanceOf(ZephyrUpsertError)
            const zephyrError = error as ZephyrUpsertError
            expect(zephyrError.attempts.length).toBeGreaterThan(0)
            expect(zephyrError.attempts[0]?.requestBody).toBeTruthy()
            expect(zephyrError.attempts[0]?.error).toContain('Zephyr(upsert) 400')
            expect(zephyrError.attempts[0]?.request).toMatchObject({
                method: 'PUT',
            })
            expect(zephyrError.attempts[0]?.response).toMatchObject({
                status: 400,
                statusText: 'Bad Request',
            })
        }
    })
})
