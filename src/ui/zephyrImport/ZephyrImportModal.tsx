import * as React from 'react'
import type {
    ZephyrImportApplyResult,
    ZephyrImportPreview,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@app/sync'
import {
    PreviewDialog,
    PreviewDialogSplit,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { useZephyrImportModalController } from './zephyrImportModalController'
import { useZephyrImportDerivedState } from './zephyrImportModalDerived'
import { ZephyrImportPreviewPane } from './ZephyrImportPreviewPane'
import { ZephyrImportScopeForm } from './ZephyrImportScopeForm'
import { useZephyrImportModalReset } from './useZephyrImportModalReset'
import {
    useZephyrImportModalSectionProps,
    useZephyrImportPreviewPaneProps,
} from './useZephyrImportModalSectionProps'
import { useZephyrImportModalState } from './useZephyrImportModalState'
import { useZephyrImportModalView } from './useZephyrImportModalView'

type Props = {
    open: boolean
    destinationLabel: string
    onClose(): void
    onPreview(request: Omit<ZephyrImportRequest, 'destinationFolderId'>): Promise<ZephyrImportPreview>
    onApply(preview: ZephyrImportPreview): Promise<ZephyrImportApplyResult>
}

export function ZephyrImportModal({ open, destinationLabel, onClose, onPreview, onApply }: Props) {
    const { t } = useUiPreferences()
    const {
        refs: modalRefs,
        formState,
        formActions,
        statusState,
        statusActions,
        previewState,
        previewActions,
    } = useZephyrImportModalState()

    useZephyrImportModalReset({
        open,
        destinationLabel,
        itemRefs: modalRefs.itemRefs,
        setError: statusActions.setError,
        setPreview: previewActions.setPreview,
        setStrategies: previewActions.setStrategies,
        setStatusFilter: previewActions.setStatusFilter,
        setShowUnchanged: previewActions.setShowUnchanged,
    })

    // Derived preview state
    const {
        refs,
        request,
        items,
        conflictItems,
        replaceCount,
        strategySummary,
        visibleItems,
    } = useZephyrImportDerivedState({
        mode: formState.mode,
        projectKey: formState.projectKey,
        folder: formState.folder,
        refsText: formState.refsText,
        rawQuery: formState.rawQuery,
        maxResults: formState.maxResults,
        mirrorRemoteFolders: formState.mirrorRemoteFolders,
        preview: previewState.preview,
        strategies: previewState.strategies,
        statusFilter: previewState.statusFilter,
        showUnchanged: previewState.showUnchanged,
    })

    // Handlers
    const { handlePreview, handleApply } = useZephyrImportModalController({
        request,
        preview: previewState.preview,
        strategies: previewState.strategies,
        itemRefs: modalRefs.itemRefs,
        onPreview,
        onApply,
        onClose,
        previewErrorMessage: t('import.previewError'),
        applyErrorMessage: t('import.applyError'),
        setLoading: statusActions.setLoading,
        setApplying: statusActions.setApplying,
        setError: statusActions.setError,
        setPreview: previewActions.setPreview,
        setStrategies: previewActions.setStrategies,
        setStatusFilter: previewActions.setStatusFilter,
        setShowUnchanged: previewActions.setShowUnchanged,
    })
    const {
        hiddenCount,
        hiddenUnchangedCount,
        firstConflictId,
        canPreview,
        initialFocusRef,
        handleStatusFilterChange,
        handleShowUnchangedChange,
        scrollToItem,
    } = useZephyrImportModalView({
        mode: formState.mode,
        projectKey: formState.projectKey,
        folder: formState.folder,
        refs,
        loading: statusState.loading,
        applying: statusState.applying,
        items,
        conflictItems,
        visibleItems,
        statusFilter: previewState.statusFilter,
        showUnchanged: previewState.showUnchanged,
        projectInputRef: modalRefs.projectInputRef,
        folderInputRef: modalRefs.folderInputRef,
        refsInputRef: modalRefs.refsInputRef,
        itemRefs: modalRefs.itemRefs,
        setStatusFilter: previewActions.setStatusFilter,
        setShowUnchanged: previewActions.setShowUnchanged,
    })

    const handleResetFilters = React.useCallback(() => {
        previewActions.setStatusFilter('all')
        previewActions.setShowUnchanged(false)
    }, [previewActions])

    const handleChangeStrategy = React.useCallback((itemId: string, value: ZephyrImportStrategy) => {
        previewActions.setStrategies((current) => ({ ...current, [itemId]: value }))
    }, [previewActions])

    const { scopeFormProps } = useZephyrImportModalSectionProps({
        formState,
        statusState,
        refs: {
            projectInputRef: modalRefs.projectInputRef,
            folderInputRef: modalRefs.folderInputRef,
            refsInputRef: modalRefs.refsInputRef,
        },
        canPreview,
        onClose,
        onSubmit: handlePreview,
        formActions,
    })
    const { previewPaneProps } = useZephyrImportPreviewPaneProps({
        preview: previewState.preview,
        items,
        visibleItems,
        conflictItems,
        strategies: previewState.strategies,
        statusFilter: previewState.statusFilter,
        showUnchanged: previewState.showUnchanged,
        hiddenCount,
        hiddenUnchangedCount,
        replaceCount,
        firstConflictId,
        loading: statusState.loading,
        applying: statusState.applying,
        itemRefs: modalRefs.itemRefs,
        strategySummary,
        onApply: handleApply,
        onResetFilters: handleResetFilters,
        onChangeStrategy: handleChangeStrategy,
        onStatusFilterChange: handleStatusFilterChange,
        onShowUnchangedChange: handleShowUnchangedChange,
        onJumpToItem: scrollToItem,
    })

    // Render
    return (
        <PreviewDialog
            open={open}
            title={t('import.title')}
            subtitle={t('import.subtitle', { label: destinationLabel })}
            onClose={onClose}
            initialFocusRef={initialFocusRef}
            canDismiss={!statusState.loading && !statusState.applying}
        >
            <PreviewDialogSplit
                sidebar={(
                    <ZephyrImportScopeForm {...scopeFormProps} />
                )}
                content={(
                    <ZephyrImportPreviewPane {...previewPaneProps} />
                )}
            />
        </PreviewDialog>
    )
}
