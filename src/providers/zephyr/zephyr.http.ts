// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderTestRef, SearchOptions } from '../types'
import { buildUpsertBodies, shouldRetryVariablePayload } from './internal/zephyrUpsertPayload'
import { mapZephyrTestDetails } from './internal/zephyrDetails'
import { parseZephyrRef } from './internal/zephyrRef'
import type { ZephyrTestCaseResponse } from './internal/zephyrResponses'
import { searchZephyrTests } from './internal/zephyrSearchLoop'
import { safeStr } from './internal/zephyrValueMapping'

export interface ZephyrApiClient {
    zephyrGetTestCase<T = unknown>(ref: string, by: 'id' | 'key'): Promise<T>
    zephyrSearchTestCases<T = unknown>(query: string, startAt?: number, maxResults?: number): Promise<T>
    zephyrUpsertTestCase<T = unknown>(body: unknown, ref?: string): Promise<T>
    zephyrUploadAttachment(testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }): Promise<void>
    zephyrDeleteAttachment(attachmentId: string): Promise<void>
}

export interface ZephyrRequestDebug {
    method: string
    url: string
    body?: unknown
}

export interface ZephyrResponseDebug {
    status?: number
    statusText?: string
    body?: string
}

export interface ZephyrUpsertAttemptDebug {
    requestBody: unknown
    request?: ZephyrRequestDebug
    response?: ZephyrResponseDebug
    error: string
}

export class ZephyrUpsertError extends Error {
    attempts: ZephyrUpsertAttemptDebug[]

    constructor(message: string, attempts: ZephyrUpsertAttemptDebug[]) {
        super(message)
        this.name = 'ZephyrUpsertError'
        this.attempts = attempts
    }
}

type ZephyrClientErrorLike = {
    request?: unknown
    response?: unknown
}

function isRequestDebug(value: unknown): value is ZephyrRequestDebug {
    return Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as { method?: unknown }).method === 'string' &&
        typeof (value as { url?: unknown }).url === 'string'
    )
}

function isResponseDebug(value: unknown): value is ZephyrResponseDebug {
    return Boolean(
        value &&
        typeof value === 'object' &&
        (
            'status' in (value as Record<string, unknown>) ||
            'statusText' in (value as Record<string, unknown>) ||
            'body' in (value as Record<string, unknown>)
        )
    )
}

function toUpsertAttemptDebug(body: unknown, error: unknown): ZephyrUpsertAttemptDebug {
    const message = error instanceof Error ? error.message : String(error ?? 'Zephyr upsert failed')
    const attempt: ZephyrUpsertAttemptDebug = {
        requestBody: body,
        error: message,
    }

    if (!error || typeof error !== 'object') return attempt

    const candidate = error as ZephyrClientErrorLike
    if (isRequestDebug(candidate.request)) attempt.request = candidate.request
    if (isResponseDebug(candidate.response)) attempt.response = candidate.response

    return attempt
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
        const attempts: ZephyrUpsertAttemptDebug[] = []

        for (let index = 0; index < bodies.length; index += 1) {
            const body = bodies[index]
            try {
                const json = await this.client.zephyrUpsertTestCase<Record<string, unknown>>(body, ref || undefined)
                return { externalId: safeStr(json?.key).trim() || ref || payload.id || '' }
            } catch (error) {
                lastError = error
                attempts.push(toUpsertAttemptDebug(body, error))
                if (!shouldRetryVariablePayload(error) || index === bodies.length - 1) break
            }
        }

        const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Zephyr upsert failed')
        throw new ZephyrUpsertError(message, attempts)
    }

    async attach(externalId: string, attachment: { name: string; pathOrDataUrl: string }) {
        return this.client.zephyrUploadAttachment(externalId, attachment)
    }

    async deleteAttachment(_externalId: string, attachmentId: string) {
        return this.client.zephyrDeleteAttachment(attachmentId)
    }
}
