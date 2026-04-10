import * as React from 'react'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem, ZephyrPublishResult } from '@app/sync'

type Translate = (key: string, params?: Record<string, string | number>) => string

export type PublishOutcome = ZephyrPublishResult & {
    snapshotPath: string
    logPath: string
}

export type PublishStatusFilter = 'all' | ZephyrPublishPreviewItem['status']

type Args = {
    open: boolean
    selectionLabel: string
    onClose(): void
    onPreview(): Promise<ZephyrPublishPreview>
    onApply(preview: ZephyrPublishPreview): Promise<PublishOutcome>
    t: Translate
}

export function useZephyrPublishDialogState({
    open,
    selectionLabel,
    onClose,
    onPreview,
    onApply,
    t,
}: Args) {
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrPublishPreview | null>(null)
    const [publishMap, setPublishMap] = React.useState<Record<string, boolean>>({})
    const [confirmText, setConfirmText] = React.useState('')
    const [statusFilter, setStatusFilter] = React.useState<PublishStatusFilter>('all')
    const [showSkipped, setShowSkipped] = React.useState(false)
    const [selectedOnly, setSelectedOnly] = React.useState(false)

    React.useEffect(() => {
        if (!open) return
        setError(null)
        setPreview(null)
        setPublishMap({})
        setConfirmText('')
        setStatusFilter('all')
        setShowSkipped(false)
        setSelectedOnly(false)
    }, [open, selectionLabel])

    const handlePreview = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const nextPreview = await onPreview()
            setPreview(nextPreview)
            setPublishMap(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.publish])))
            setStatusFilter('all')
            setShowSkipped(false)
            setSelectedOnly(false)
            return nextPreview
        } catch (err) {
            setPreview(null)
            setPublishMap({})
            setError(err instanceof Error ? err.message : t('publish.previewError'))
            return null
        } finally {
            setLoading(false)
        }
    }, [onPreview, t])

    React.useEffect(() => {
        if (!open || preview || loading || applying) return
        void handlePreview()
    }, [applying, handlePreview, loading, open, preview])

    const handleApply = React.useCallback(async () => {
        if (!preview) return
        setApplying(true)
        setError(null)
        try {
            await onApply({
                ...preview,
                items: preview.items.map((item) => ({
                    ...item,
                    publish: publishMap[item.id] ?? item.publish,
                })),
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : t('publish.applyError'))
        } finally {
            setApplying(false)
        }
    }, [onApply, onClose, preview, publishMap, t])

    const handleStatusFilterChange = React.useCallback((nextFilter: PublishStatusFilter) => {
        if (nextFilter === 'skip') setShowSkipped(true)
        setStatusFilter(nextFilter)
    }, [])

    const handleShowSkippedChange = React.useCallback((checked: boolean) => {
        setShowSkipped(checked)
        if (!checked && statusFilter === 'skip') {
            setStatusFilter('all')
        }
    }, [statusFilter])

    const items = preview?.items ?? []
    const blockedItems = React.useMemo(
        () => items.filter((item) => item.status === 'blocked'),
        [items]
    )
    const visibleItems = React.useMemo(
        () =>
            items.filter((item) => {
                if (statusFilter !== 'all' && item.status !== statusFilter) return false
                if (!showSkipped && statusFilter !== 'skip' && item.status === 'skip') return false
                if (selectedOnly && !(publishMap[item.id] ?? item.publish)) return false
                return true
            }),
        [items, publishMap, selectedOnly, showSkipped, statusFilter]
    )
    const selectedCount = items.filter((item) => publishMap[item.id] ?? item.publish).length
    const hiddenCount = items.length - visibleItems.length
    const hiddenSkippedCount = items.filter(
        (item) => item.status === 'skip' && (statusFilter !== 'skip' || !showSkipped)
    ).length
    const firstBlockedId = blockedItems[0]?.id
    const confirmReady = confirmText.trim().toUpperCase() === 'PUBLISH'
    const requiresConfirmation = selectedCount > 1
    const canApply = !!preview && !loading && !applying && selectedCount > 0 && (!requiresConfirmation || confirmReady)
    const disabledReason = !preview
        ? t('publish.previewLoadingHint')
        : selectedCount === 0
            ? t('publish.noSelected')
            : requiresConfirmation && !confirmReady
                ? t('publish.confirmationMissing')
                : null

    return {
        loading,
        applying,
        error,
        preview,
        publishMap,
        confirmText,
        statusFilter,
        showSkipped,
        selectedOnly,
        blockedItems,
        visibleItems,
        selectedCount,
        hiddenCount,
        hiddenSkippedCount,
        firstBlockedId,
        confirmReady,
        requiresConfirmation,
        canApply,
        disabledReason,
        setPublishMap,
        setConfirmText,
        setStatusFilter,
        setShowSkipped,
        setSelectedOnly,
        handlePreview,
        handleApply,
        handleStatusFilterChange,
        handleShowSkippedChange,
    }
}
