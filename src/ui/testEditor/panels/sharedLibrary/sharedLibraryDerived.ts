import * as React from 'react'
import { buildSharedUsageIndex, type ResolvedWikiRef, type SharedUsage } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import { countBrokenRefs, flattenStepText, makeSharedPreview } from './sharedLibraryText'

export type SharedFilter = 'all' | 'used' | 'unused' | 'broken'
export type SharedSort = 'usage' | 'name' | 'broken'

export type SharedListEntry = {
    shared: SharedStep
    usageCount: number
    usages: SharedUsage[]
    brokenRefCount: number
    searchableText: string
    preview: string
}

type UseSharedLibraryDerivedOptions = {
    sharedSteps: SharedStep[]
    allTests: TestCase[]
    inspectRefs(src: string): ResolvedWikiRef[]
    selectedSharedId: string | null
    query: string
    filter: SharedFilter
    sort: SharedSort
}

export function useSharedLibraryDerived({
    sharedSteps,
    allTests,
    inspectRefs,
    selectedSharedId,
    query,
    filter,
    sort,
}: UseSharedLibraryDerivedOptions) {
    const usageIndex = React.useMemo(() => buildSharedUsageIndex(allTests, sharedSteps), [allTests, sharedSteps])

    const entries = React.useMemo<SharedListEntry[]>(
        () =>
            sharedSteps.map((shared) => {
                const usages = usageIndex.get(shared.id) ?? []
                const preview = makeSharedPreview(shared.steps)

                return {
                    shared,
                    usages,
                    usageCount: usages.length,
                    brokenRefCount: countBrokenRefs(shared.steps, inspectRefs),
                    searchableText: `${shared.name}\n${flattenStepText(shared.steps)}`.toLowerCase(),
                    preview,
                }
            }),
        [inspectRefs, sharedSteps, usageIndex]
    )

    const selectedEntry = React.useMemo(
        () => entries.find((entry) => entry.shared.id === selectedSharedId) ?? entries[0] ?? null,
        [entries, selectedSharedId]
    )

    const usages = selectedEntry?.usages ?? []

    const filterCounts = React.useMemo(
        () => ({
            all: entries.length,
            used: entries.filter((entry) => entry.usageCount > 0).length,
            unused: entries.filter((entry) => entry.usageCount === 0).length,
            broken: entries.filter((entry) => entry.brokenRefCount > 0).length,
        }),
        [entries]
    )

    const filteredEntries = React.useMemo(() => {
        const trimmedQuery = query.trim().toLowerCase()
        const next = entries.filter((entry) => {
            if (filter === 'used' && entry.usageCount === 0) return false
            if (filter === 'unused' && entry.usageCount > 0) return false
            if (filter === 'broken' && entry.brokenRefCount === 0) return false
            if (!trimmedQuery) return true
            return entry.searchableText.includes(trimmedQuery)
        })

        next.sort((left, right) => {
            if (sort === 'name') return left.shared.name.localeCompare(right.shared.name)
            if (sort === 'broken') {
                return (
                    right.brokenRefCount - left.brokenRefCount ||
                    right.usageCount - left.usageCount ||
                    left.shared.name.localeCompare(right.shared.name)
                )
            }

            return (
                right.usageCount - left.usageCount ||
                right.brokenRefCount - left.brokenRefCount ||
                left.shared.name.localeCompare(right.shared.name)
            )
        })

        return next
    }, [entries, filter, query, sort])

    return {
        entries,
        selectedEntry,
        usages,
        filterCounts,
        filteredEntries,
    }
}
