import type { ProviderTestRef } from './types'
import { safeStr } from './zephyrValueMapping'

export function normalizeSearchPage(raw: unknown): { items: ProviderTestRef[]; hasMore: boolean; nextStartAt: number } {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const rawItems: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray(source.items)
            ? source.items
            : Array.isArray(source.values)
                ? source.values
                : Array.isArray(source.results)
                    ? source.results
                    : []

    const items = rawItems
        .map((item): ProviderTestRef | null => normalizeSearchItem(item))
        .filter((item): item is ProviderTestRef => item !== null)

    const currentStartAt = toNumber(source.startAt ?? source.offset) ?? 0
    const nextStartAt = currentStartAt + rawItems.length
    const total = toNumber(source.total ?? source.totalCount ?? source.size)
    const configuredPageSize = toNumber(source.maxResults ?? source.pageSize ?? source.limit)
    const hasMore = total != null
        ? nextStartAt < total
        : configuredPageSize != null
            ? rawItems.length >= configuredPageSize && rawItems.length > 0
            : false

    return { items, hasMore, nextStartAt }
}

export function normalizeSearchItem(raw: unknown): ProviderTestRef | null {
    const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
    const sourceTestCase = source.testCase && typeof source.testCase === 'object'
        ? source.testCase as Record<string, unknown>
        : undefined
    const sourceProject = source.project && typeof source.project === 'object'
        ? source.project as Record<string, unknown>
        : undefined
    const key = safeStr(source.key ?? source.testCaseKey ?? sourceTestCase?.key).trim()
    const id = safeStr(source.id ?? sourceTestCase?.id).trim()
    const ref = key || id

    if (!ref) return null

    return {
        ref,
        key: key || undefined,
        name: safeStr(source.name ?? sourceTestCase?.name).trim() || undefined,
        folder: safeStr(source.folder ?? sourceTestCase?.folder).trim() || undefined,
        projectKey: safeStr(
            source.projectKey ??
            sourceProject?.key ??
            sourceTestCase?.projectKey
        ).trim() || undefined,
        updatedAt: safeStr(source.updatedOn ?? source.updatedAt ?? sourceTestCase?.updatedOn).trim() || undefined,
    }
}

function toNumber(value: unknown): number | undefined {
    const next = Number(value)
    return Number.isFinite(next) ? next : undefined
}
