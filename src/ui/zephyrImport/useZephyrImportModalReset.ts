import * as React from 'react'
import type { ZephyrImportPreview, ZephyrImportStrategy } from '@app/sync'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

type Options = {
    open: boolean
    destinationLabel: string
    itemRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
    setError: React.Dispatch<React.SetStateAction<string | null>>
    setPreview: React.Dispatch<React.SetStateAction<ZephyrImportPreview | null>>
    setStrategies: React.Dispatch<React.SetStateAction<Record<string, ZephyrImportStrategy>>>
    setStatusFilter: React.Dispatch<React.SetStateAction<ImportStatusFilter>>
    setShowUnchanged: React.Dispatch<React.SetStateAction<boolean>>
}

export function useZephyrImportModalReset({
    open,
    destinationLabel,
    itemRefs,
    setError,
    setPreview,
    setStrategies,
    setStatusFilter,
    setShowUnchanged,
}: Options) {
    React.useEffect(() => {
        if (!open) return
        itemRefs.current = {}
        setError(null)
        setPreview(null)
        setStrategies({})
        setStatusFilter('all')
        setShowUnchanged(false)
    }, [destinationLabel, itemRefs, open, setError, setPreview, setShowUnchanged, setStatusFilter, setStrategies])
}
