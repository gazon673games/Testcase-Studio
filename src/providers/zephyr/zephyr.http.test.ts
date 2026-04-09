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

describe('ZephyrHttpProvider.getTestDetails', () => {
    it('loads included Zephyr test cases referenced by testCaseKey steps', async () => {
        const client: ZephyrApiClient = {
            zephyrGetTestCase: async <T = unknown>(ref: string) => {
                if (ref === 'PROD-T11508') {
                    return {
                        key: 'PROD-T11508',
                        name: 'Parent case',
                        testScript: {
                            steps: [
                                { id: 1, index: 1, testCaseKey: 'PROD-T9701' },
                                { id: 2, index: 2, description: 'Standalone step', testData: '', expectedResult: '' },
                            ],
                        },
                    } as T
                }

                if (ref === 'PROD-T9701') {
                    return {
                        key: 'PROD-T9701',
                        name: 'Included case',
                        testScript: {
                            steps: [
                                { id: 10, index: 1, description: 'Call nested API', testData: 'Input payload', expectedResult: '200 OK' },
                            ],
                        },
                    } as T
                }

                throw new Error(`Unexpected ref ${ref}`)
            },
            zephyrSearchTestCases: async <T = unknown>() => ({} as T),
            zephyrUpsertTestCase: async <T = unknown>() => ({} as T),
            zephyrUploadAttachment: async () => undefined,
            zephyrDeleteAttachment: async () => undefined,
        }

        const provider = new ZephyrHttpProvider(client)
        const test = await provider.getTestDetails('PROD-T11508')

        expect(test.steps[0]?.testCaseKey).toBe('PROD-T9701')
        expect(test.steps[0]?.includedTest?.id).toBe('PROD-T9701')
        expect(test.steps[0]?.includedTest?.name).toBe('Included case')
        expect(test.steps[0]?.includedTest?.steps[0]?.action).toBe('Call nested API')
    })
})
