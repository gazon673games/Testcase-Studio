// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderTestRef, SearchOptions } from '../types'
import { buildUpsertBodies, shouldRetryVariablePayload } from './zephyrUpsertPayload'
import { mapZephyrTestDetails } from './zephyrDetails'
import { parseZephyrRef } from './zephyrRef'
import type { ZephyrTestCaseResponse } from './zephyrResponses'
import { searchZephyrTests } from './zephyrSearchLoop'
import { safeStr } from './zephyrValueMapping'

export interface ZephyrApiClient {
    zephyrGetTestCase<T = unknown>(ref: string, by: 'id' | 'key'): Promise<T>
    zephyrSearchTestCases<T = unknown>(query: string, startAt?: number, maxResults?: number): Promise<T>
    zephyrUpsertTestCase<T = unknown>(body: unknown, ref?: string): Promise<T>
    zephyrUploadAttachment(testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }): Promise<void>
    zephyrDeleteAttachment(attachmentId: string): Promise<void>
}

// Provider facade
export class ZephyrHttpProvider implements ITestProvider {
    constructor(private client: ZephyrApiClient) {}

    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const { by, ref } = parseZephyrRef(externalId)
        const json = (await this.client.zephyrGetTestCase(ref, by)) as ZephyrTestCaseResponse
        return mapZephyrTestDetails(json, ref)
    }

    async searchTestsByQuery(query: string, opts: SearchOptions = {}): Promise<ProviderTestRef[]> {
        return searchZephyrTests(this.client, query, opts)
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        const parsed = parseZephyrRef(payload.id)
        const ref = parsed.by === 'key' ? parsed.ref : ''
        const bodies = buildUpsertBodies(payload, Boolean(parsed.ref))
        let lastError: unknown = null

        for (let index = 0; index < bodies.length; index += 1) {
            const body = bodies[index]
            try {
                const json = await this.client.zephyrUpsertTestCase<Record<string, unknown>>(body, ref || undefined)
                return { externalId: safeStr(json?.key).trim() || ref || payload.id || '' }
            } catch (error) {
                lastError = error
                if (!shouldRetryVariablePayload(error) || index === bodies.length - 1) break
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Zephyr upsert failed'))
    }

    async attach(externalId: string, attachment: { name: string; pathOrDataUrl: string }) {
        return this.client.zephyrUploadAttachment(externalId, attachment)
    }

    async deleteAttachment(_externalId: string, attachmentId: string) {
        return this.client.zephyrDeleteAttachment(attachmentId)
    }
}
