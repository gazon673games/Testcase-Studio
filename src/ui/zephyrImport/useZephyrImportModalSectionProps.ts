import * as React from 'react'
import type {
    ZephyrImportPreview,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@app/sync'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

type ScopeFormOptions = {
    formState: {
        mode: 'project' | 'folder' | 'keys'
        projectKey: string
        folder: string
        refsText: string
        rawQuery: string
        maxResults: string
        mirrorRemoteFolders: boolean
    }
    statusState: {
        loading: boolean
        applying: boolean
        error: string | null
    }
    refs: {
        projectInputRef: React.RefObject<HTMLInputElement | null>
        folderInputRef: React.RefObject<HTMLInputElement | null>
        refsInputRef: React.RefObject<HTMLTextAreaElement | null>
    }
    canPreview: boolean
    onClose(): void
    onSubmit(event?: React.FormEvent): void | Promise<void>
    formActions: {
        setMode(value: 'project' | 'folder' | 'keys'): void
        setProjectKey(value: string): void
        setFolder(value: string): void
        setRefsText(value: string): void
        setRawQuery(value: string): void
        setMaxResults(value: string): void
        setMirrorRemoteFolders(value: boolean): void
    }
}

type PreviewPaneOptions = {
    preview: ZephyrImportPreview | null
    items: ZephyrImportPreview['items']
    visibleItems: ZephyrImportPreview['items']
    conflictItems: ZephyrImportPreview['items']
    strategies: Record<string, ZephyrImportStrategy>
    statusFilter: ImportStatusFilter
    showUnchanged: boolean
    hiddenCount: number
    hiddenUnchangedCount: number
    replaceCount: number
    firstConflictId?: string
    loading: boolean
    applying: boolean
    itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    strategySummary: Record<ZephyrImportStrategy, number>
    onApply(): void | Promise<void>
    onResetFilters(): void
    onChangeStrategy(itemId: string, value: ZephyrImportStrategy): void
    onStatusFilterChange(value: ImportStatusFilter): void
    onShowUnchangedChange(value: boolean): void
    onJumpToItem(itemId?: string): void
}

export function useZephyrImportModalSectionProps({
    formState,
    statusState,
    refs,
    canPreview,
    onClose,
    onSubmit,
    formActions,
}: ScopeFormOptions) {
    const scopeFormProps = React.useMemo(
        () => ({
            mode: formState.mode,
            projectKey: formState.projectKey,
            folder: formState.folder,
            refsText: formState.refsText,
            rawQuery: formState.rawQuery,
            maxResults: formState.maxResults,
            mirrorRemoteFolders: formState.mirrorRemoteFolders,
            loading: statusState.loading,
            applying: statusState.applying,
            error: statusState.error,
            canPreview,
            projectInputRef: refs.projectInputRef,
            folderInputRef: refs.folderInputRef,
            refsInputRef: refs.refsInputRef,
            onClose,
            onSubmit,
            ...formActions,
        }),
        [canPreview, formActions, formState, onClose, onSubmit, refs, statusState]
    )

    return {
        scopeFormProps,
    }
}

export function useZephyrImportPreviewPaneProps({
    preview,
    items,
    visibleItems,
    conflictItems,
    strategies,
    statusFilter,
    showUnchanged,
    hiddenCount,
    hiddenUnchangedCount,
    replaceCount,
    firstConflictId,
    loading,
    applying,
    itemRefs,
    strategySummary,
    onApply,
    onResetFilters,
    onChangeStrategy,
    onStatusFilterChange,
    onShowUnchangedChange,
    onJumpToItem,
}: PreviewPaneOptions) {
    const previewPaneProps = React.useMemo(
        () => ({
            preview,
            items,
            visibleItems,
            conflictItems,
            strategies,
            statusFilter,
            showUnchanged,
            hiddenCount,
            hiddenUnchangedCount,
            replaceCount,
            firstConflictId,
            loading,
            applying,
            itemRefs,
            strategySummary,
            onApply,
            onResetFilters,
            onChangeStrategy,
            onStatusFilterChange,
            onShowUnchangedChange,
            onJumpToItem,
        }),
        [
            applying,
            conflictItems,
            firstConflictId,
            hiddenCount,
            hiddenUnchangedCount,
            itemRefs,
            items,
            loading,
            onApply,
            onChangeStrategy,
            onJumpToItem,
            onResetFilters,
            onShowUnchangedChange,
            onStatusFilterChange,
            preview,
            replaceCount,
            showUnchanged,
            statusFilter,
            strategies,
            strategySummary,
            visibleItems,
        ]
    )

    return {
        previewPaneProps,
    }
}
