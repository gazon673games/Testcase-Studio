import * as React from 'react'
import { buildRefCatalog, inspectWikiRefs, resolveRefsInText, type ResolvedWikiRef } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'

type Options = {
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    activeEditorApi: MarkdownEditorApi | null
}

export function useTestEditorReferenceTools({ allTests, sharedSteps, activeEditorApi }: Options) {
    const refCatalog = React.useMemo(() => buildRefCatalog(allTests, sharedSteps), [allTests, sharedSteps])
    const resolveRefs = React.useCallback((src: string) => resolveRefsInText(src, refCatalog), [refCatalog])
    const inspectRefs = React.useCallback((src: string): ResolvedWikiRef[] => inspectWikiRefs(src, refCatalog), [refCatalog])

    const insertIntoActiveEditor = React.useCallback(async (text: string) => {
        if (activeEditorApi) {
            activeEditorApi.insertText(text)
            activeEditorApi.focus()
            return
        }

        try {
            await navigator.clipboard.writeText(text)
        } catch {
            // clipboard fallback is best-effort only
        }
    }, [activeEditorApi])

    return {
        resolveRefs,
        inspectRefs,
        insertIntoActiveEditor,
    }
}
