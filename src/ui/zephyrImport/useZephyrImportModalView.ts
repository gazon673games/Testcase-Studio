import * as React from 'react'
import type { ZephyrImportMode, ZephyrImportPreview } from '@app/sync'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

type Options = {
    mode: ZephyrImportMode
    projectKey: string
    folder: string
    refs: string[]
    loading: boolean
    applying: boolean
    items: ZephyrImportPreview['items']
    conflictItems: ZephyrImportPreview['items']
    visibleItems: ZephyrImportPreview['items']
    statusFilter: ImportStatusFilter
    showUnchanged: boolean
    projectInputRef: React.RefObject<HTMLInputElement | null>
    folderInputRef: React.RefObject<HTMLInputElement | null>
    refsInputRef: React.RefObject<HTMLTextAreaElement | null>
    itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    setStatusFilter(value: ImportStatusFilter): void
    setShowUnchanged(value: boolean): void
}

export function useZephyrImportModalView({
    mode,
    projectKey,
    folder,
    refs,
    loading,
    applying,
    items,
    conflictItems,
    visibleItems,
    statusFilter,
    showUnchanged,
    projectInputRef,
    folderInputRef,
    refsInputRef,
    itemRefs,
    setStatusFilter,
    setShowUnchanged,
}: Options) {
    const hiddenCount = items.length - visibleItems.length
    const hiddenUnchangedCount = items.filter(
        (item) => item.status === 'unchanged' && (statusFilter !== 'unchanged' || !showUnchanged)
    ).length
    const firstConflictId = conflictItems[0]?.id

    const handleStatusFilterChange = React.useCallback((nextFilter: ImportStatusFilter) => {
        if (nextFilter === 'unchanged') setShowUnchanged(true)
        setStatusFilter(nextFilter)
    }, [setShowUnchanged, setStatusFilter])

    const handleShowUnchangedChange = React.useCallback((checked: boolean) => {
        setShowUnchanged(checked)
        if (!checked && statusFilter === 'unchanged') {
            setStatusFilter('all')
        }
    }, [setShowUnchanged, setStatusFilter, statusFilter])

    const scrollToItem = React.useCallback((itemId?: string) => {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }, [itemRefs])

    const canPreview =
        !loading &&
        !applying &&
        ((mode === 'project' && projectKey.trim().length > 0) ||
            (mode === 'folder' && folder.trim().length > 0) ||
            (mode === 'keys' && refs.length > 0))

    const initialFocusRef =
        mode === 'keys'
            ? (refsInputRef as React.RefObject<HTMLElement | null>)
            : mode === 'folder'
                ? (folderInputRef as React.RefObject<HTMLElement | null>)
                : (projectInputRef as React.RefObject<HTMLElement | null>)

    return {
        hiddenCount,
        hiddenUnchangedCount,
        firstConflictId,
        canPreview,
        initialFocusRef,
        handleStatusFilterChange,
        handleShowUnchangedChange,
        scrollToItem,
    }
}
