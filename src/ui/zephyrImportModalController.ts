import * as React from 'react'
import type { ZephyrImportPreview, ZephyrImportRequest, ZephyrImportStrategy } from '@app/sync'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

type UseZephyrImportModalControllerOptions = {
    request: Omit<ZephyrImportRequest, 'destinationFolderId'>
    preview: ZephyrImportPreview | null
    strategies: Record<string, ZephyrImportStrategy>
    itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    onPreview: (request: Omit<ZephyrImportRequest, 'destinationFolderId'>) => Promise<ZephyrImportPreview>
    onApply: (preview: ZephyrImportPreview) => Promise<unknown>
    onClose: () => void
    previewErrorMessage: string
    applyErrorMessage: string
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setApplying: React.Dispatch<React.SetStateAction<boolean>>
    setError: React.Dispatch<React.SetStateAction<string | null>>
    setPreview: React.Dispatch<React.SetStateAction<ZephyrImportPreview | null>>
    setStrategies: React.Dispatch<React.SetStateAction<Record<string, ZephyrImportStrategy>>>
    setStatusFilter: React.Dispatch<React.SetStateAction<ImportStatusFilter>>
    setShowUnchanged: React.Dispatch<React.SetStateAction<boolean>>
}

export function useZephyrImportModalController({
    request,
    preview,
    strategies,
    itemRefs,
    onPreview,
    onApply,
    onClose,
    previewErrorMessage,
    applyErrorMessage,
    setLoading,
    setApplying,
    setError,
    setPreview,
    setStrategies,
    setStatusFilter,
    setShowUnchanged,
}: UseZephyrImportModalControllerOptions) {
    const handlePreview = React.useCallback(async (event?: React.FormEvent) => {
        event?.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const nextPreview = await onPreview(request)
            itemRefs.current = {}
            setPreview(nextPreview)
            setStrategies(Object.fromEntries(nextPreview.items.map((item) => [item.id, item.strategy])))
            setStatusFilter('all')
            setShowUnchanged(false)
        } catch (error) {
            setPreview(null)
            setStrategies({})
            setError(error instanceof Error ? error.message : previewErrorMessage)
        } finally {
            setLoading(false)
        }
    }, [
        itemRefs,
        onPreview,
        previewErrorMessage,
        request,
        setError,
        setLoading,
        setPreview,
        setShowUnchanged,
        setStatusFilter,
        setStrategies,
    ])

    const handleApply = React.useCallback(async () => {
        if (!preview) return

        setApplying(true)
        setError(null)

        try {
            await onApply({
                ...preview,
                items: preview.items.map((item) => ({
                    ...item,
                    strategy: strategies[item.id] ?? item.strategy,
                })),
            })
            onClose()
        } catch (error) {
            setError(error instanceof Error ? error.message : applyErrorMessage)
        } finally {
            setApplying(false)
        }
    }, [applyErrorMessage, onApply, onClose, preview, setApplying, setError, strategies])

    return {
        handlePreview,
        handleApply,
    }
}
