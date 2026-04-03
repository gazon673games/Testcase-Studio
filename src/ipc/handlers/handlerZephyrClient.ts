import {
    type ZephyrApiClient,
    type ZephyrRequestDebug,
    type ZephyrResponseDebug,
} from '../../providers/zephyr/zephyr.http.js'
import { deleteZephyrAttachment, uploadZephyrAttachment } from './handlerAttachments.js'
import { fetchWithContext, readJsonResponse } from './handlerNetwork.js'
import { loadZephyrContext } from './handlerSettings.js'

type ZephyrDebugError = Error & {
    request?: ZephyrRequestDebug
    response?: ZephyrResponseDebug
}

function createZephyrDebugError(
    message: string,
    request: ZephyrRequestDebug,
    response?: ZephyrResponseDebug
): ZephyrDebugError {
    const error = new Error(message) as ZephyrDebugError
    error.request = request
    if (response) error.response = response
    return error
}

async function readUpsertResponse<T>(
    response: Response,
    scope: string,
    request: ZephyrRequestDebug,
    fallback?: T,
    limit = 4000
): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw createZephyrDebugError(
            `${scope} ${response.status} ${response.statusText}` +
            (text ? ` - ${text.slice(0, limit)}` : ''),
            request,
            {
                status: response.status,
                statusText: response.statusText,
                body: text,
            }
        )
    }

    return await response.json().catch(() => fallback as T)
}

export function createMainZephyrClient(): ZephyrApiClient {
    return {
        async zephyrGetTestCase<T = unknown>(ref: string, by: 'id' | 'key') {
            const context = await loadZephyrContext()
            const response = await fetchWithContext(
                `${context.baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(ref)}`,
                {
                    method: 'GET',
                    headers: { Authorization: context.auth, Accept: 'application/json' },
                },
                `Zephyr(${by})`
            )

            return readJsonResponse<T>(response, `Zephyr(${by})`, 300)
        },

        async zephyrSearchTestCases<T = unknown>(query: string, startAt = 0, maxResults = 100) {
            const context = await loadZephyrContext()
            const normalizedQuery = String(query ?? '').trim()
            if (!normalizedQuery) throw new Error('Zephyr search query is empty')

            const url = new URL(`${context.baseUrl}/rest/atm/1.0/testcase/search`)
            url.searchParams.set('query', normalizedQuery)
            url.searchParams.set('startAt', String(Math.max(0, Number(startAt) || 0)))
            url.searchParams.set('maxResults', String(Math.max(1, Number(maxResults) || 100)))

            const response = await fetchWithContext(
                url.toString(),
                {
                    method: 'GET',
                    headers: { Authorization: context.auth, Accept: 'application/json' },
                },
                'Zephyr(search)'
            )

            return readJsonResponse<T>(response, 'Zephyr(search)', 300)
        },

        async zephyrUpsertTestCase<T = unknown>(body: unknown, ref?: string) {
            const context = await loadZephyrContext()
            const normalizedRef = typeof ref === 'string' && ref.trim() ? ref.trim() : ''
            const url = normalizedRef
                ? `${context.baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(normalizedRef)}`
                : `${context.baseUrl}/rest/atm/1.0/testcase`
            const method = normalizedRef ? 'PUT' : 'POST'
            const request: ZephyrRequestDebug = {
                method,
                url,
                body: body ?? {},
            }

            let response: Response
            try {
                response = await fetchWithContext(
                    url,
                    {
                        method,
                        headers: {
                            Authorization: context.auth,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(body ?? {}),
                    },
                    'Zephyr(upsert)'
                )
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                throw createZephyrDebugError(message, request)
            }

            return readUpsertResponse<T>(response, 'Zephyr(upsert)', request, {} as T)
        },

        async zephyrUploadAttachment(testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }) {
            const context = await loadZephyrContext()
            await uploadZephyrAttachment(context, testCaseKey, attachment)
        },

        async zephyrDeleteAttachment(attachmentId: string) {
            const context = await loadZephyrContext()
            await deleteZephyrAttachment(context, attachmentId)
        },
    }
}
