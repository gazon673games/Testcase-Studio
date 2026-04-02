import type { ProviderTestRef, SearchOptions } from '../../types'
import { normalizeSearchPage } from './zephyrSearchParsing'

type ZephyrSearchClient = {
    zephyrSearchTestCases<T = unknown>(query: string, startAt?: number, maxResults?: number): Promise<T>
}

export async function searchZephyrTests(
    client: ZephyrSearchClient,
    query: string,
    opts: SearchOptions = {}
): Promise<ProviderTestRef[]> {
    const limit = Math.max(1, Math.min(Number(opts.maxResults ?? 100) || 100, 500))
    const startAt = Math.max(0, Number(opts.startAt ?? 0) || 0)
    const pageSize = Math.min(limit, 100)
    const results: ProviderTestRef[] = []
    const seenRefs = new Set<string>()
    let cursor = startAt

    while (results.length < limit) {
        const raw = await client.zephyrSearchTestCases(query, cursor, Math.min(pageSize, limit - results.length))
        const page = normalizeSearchPage(raw)
        if (!page.items.length) break

        for (const item of page.items) {
            if (seenRefs.has(item.ref)) continue
            seenRefs.add(item.ref)
            results.push(item)
            if (results.length >= limit) break
        }

        if (!page.hasMore) break
        cursor = page.nextStartAt
    }

    return results
}
