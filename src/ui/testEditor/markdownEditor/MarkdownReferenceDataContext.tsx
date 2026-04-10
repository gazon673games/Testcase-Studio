import * as React from 'react'
import { buildRefCatalog, renderRefsInText, type RefCatalog } from '@core/refs'
import { buildAutocompleteIndex, type AutocompleteIndex } from './autocompleteIndex'
import { toPreviewishPlainText } from './autocomplete'
import type { RefShared, RefTest } from './types'

export type SharedMarkdownReferenceData = {
    refCatalog: RefCatalog
    getAutocompleteIndex(): AutocompleteIndex
}

const MarkdownReferenceDataContext = React.createContext<SharedMarkdownReferenceData | null>(null)

type ProviderProps = {
    value: SharedMarkdownReferenceData
    children: React.ReactNode
}

export function MarkdownReferenceDataProvider({ value, children }: ProviderProps) {
    return (
        <MarkdownReferenceDataContext.Provider value={value}>
            {children}
        </MarkdownReferenceDataContext.Provider>
    )
}

export function useMarkdownReferenceData() {
    return React.useContext(MarkdownReferenceDataContext)
}

export function useSharedMarkdownReferenceData(allTests: RefTest[], sharedSteps: RefShared[]): SharedMarkdownReferenceData {
    const refCatalog = React.useMemo(
        () => buildRefCatalog(allTests as never[], sharedSteps as never[]),
        [allTests, sharedSteps]
    )

    const resolveDisplayText = React.useCallback(
        (source: string | undefined) =>
            toPreviewishPlainText(renderRefsInText(String(source ?? ''), refCatalog, { mode: 'plain' })),
        [refCatalog]
    )

    const autocompleteIndexRef = React.useRef<AutocompleteIndex | null>(null)

    React.useEffect(() => {
        autocompleteIndexRef.current = null
    }, [allTests, sharedSteps, resolveDisplayText])

    const getAutocompleteIndex = React.useCallback(() => {
        if (!autocompleteIndexRef.current) {
            autocompleteIndexRef.current = buildAutocompleteIndex(allTests, sharedSteps, resolveDisplayText)
        }
        return autocompleteIndexRef.current
    }, [allTests, resolveDisplayText, sharedSteps])

    return React.useMemo(
        () => ({ refCatalog, getAutocompleteIndex }),
        [getAutocompleteIndex, refCatalog]
    )
}
