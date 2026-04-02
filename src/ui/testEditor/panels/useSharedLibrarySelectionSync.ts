import * as React from 'react'
import type { SharedListEntry } from './sharedLibraryDerived'

type Options = {
    entries: SharedListEntry[]
    filteredEntries: SharedListEntry[]
    selectedEntry: SharedListEntry | null
    onSelectShared(sharedId: string): void
}

export function useSharedLibrarySelectionSync({
    entries,
    filteredEntries,
    selectedEntry,
    onSelectShared,
}: Options) {
    React.useEffect(() => {
        if (!selectedEntry && entries[0]) onSelectShared(entries[0].shared.id)
    }, [entries, onSelectShared, selectedEntry])

    React.useEffect(() => {
        if (!filteredEntries.length) return
        if (selectedEntry && filteredEntries.some((entry) => entry.shared.id === selectedEntry.shared.id)) return
        onSelectShared(filteredEntries[0].shared.id)
    }, [filteredEntries, onSelectShared, selectedEntry])
}
