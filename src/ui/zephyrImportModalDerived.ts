import * as React from 'react'
import type {
    ZephyrImportMode,
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@app/sync'

export type ImportStatusFilter = 'all' | ZephyrImportPreviewItem['status']

type UseZephyrImportDerivedStateOptions = {
    mode: ZephyrImportMode
    projectKey: string
    folder: string
    refsText: string
    rawQuery: string
    maxResults: string
    mirrorRemoteFolders: boolean
    preview: ZephyrImportPreview | null
    strategies: Record<string, ZephyrImportStrategy>
    statusFilter: ImportStatusFilter
    showUnchanged: boolean
}

export function useZephyrImportDerivedState({
    mode,
    projectKey,
    folder,
    refsText,
    rawQuery,
    maxResults,
    mirrorRemoteFolders,
    preview,
    strategies,
    statusFilter,
    showUnchanged,
}: UseZephyrImportDerivedStateOptions) {
    const refs = React.useMemo(
        () =>
            refsText
                .split(/[\s,;]+/g)
                .map((item) => item.trim())
                .filter(Boolean),
        [refsText]
    )

    const request = React.useMemo<Omit<ZephyrImportRequest, 'destinationFolderId'>>(
        () => ({
            mode,
            projectKey,
            folder,
            refs,
            rawQuery,
            maxResults: Math.max(1, Number(maxResults) || 100),
            mirrorRemoteFolders,
        }),
        [folder, maxResults, mirrorRemoteFolders, mode, projectKey, rawQuery, refs]
    )

    const items = preview?.items ?? []

    const conflictItems = React.useMemo(
        () => items.filter((item) => item.status === 'conflict'),
        [items]
    )

    const replaceCount = React.useMemo(
        () =>
            items.filter((item) => {
                if (item.status === 'unchanged') return false
                return (strategies[item.id] ?? item.strategy) === 'replace'
            }).length,
        [items, strategies]
    )

    const strategySummary = React.useMemo(() => {
        const counts: Record<ZephyrImportStrategy, number> = {
            replace: 0,
            skip: 0,
            'merge-locally-later': 0,
        }

        for (const item of conflictItems) {
            const strategy = strategies[item.id] ?? item.strategy
            counts[strategy] += 1
        }

        return counts
    }, [conflictItems, strategies])

    const visibleItems = React.useMemo(
        () =>
            items.filter((item) => {
                if (statusFilter !== 'all' && item.status !== statusFilter) return false
                if (!showUnchanged && statusFilter !== 'unchanged' && item.status === 'unchanged') return false
                return true
            }),
        [items, showUnchanged, statusFilter]
    )

    return {
        refs,
        request,
        items,
        conflictItems,
        replaceCount,
        strategySummary,
        visibleItems,
    }
}
