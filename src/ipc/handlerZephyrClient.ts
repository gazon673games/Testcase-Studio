import { type ZephyrApiClient } from '../providers/zephyr.http.js'
import { deleteZephyrAttachment, uploadZephyrAttachment } from './handlerAttachments.js'
import { fetchWithContext, readJsonResponse } from './handlerNetwork.js'
import { loadZephyrContext } from './handlerSettings.js'

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

            const response = await fetchWithContext(
                url,
                {
                    method: normalizedRef ? 'PUT' : 'POST',
                    headers: {
                        Authorization: context.auth,
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body ?? {}),
                },
                'Zephyr(upsert)'
            )

            return readJsonResponse<T>(response, 'Zephyr(upsert)', 400, {} as T)
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
