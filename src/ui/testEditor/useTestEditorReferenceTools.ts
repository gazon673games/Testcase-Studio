import * as React from 'react'
import { inspectWikiRefs, resolveRefsInText, type RefCatalog, type ResolvedWikiRef } from '@core/refs'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'

type Options = {
    refCatalog: RefCatalog
    activeEditorApi: MarkdownEditorApi | null
}

export function useTestEditorReferenceTools({ refCatalog, activeEditorApi }: Options) {
    const resolveCacheRef = React.useRef(new Map<string, string>())
    const inspectCacheRef = React.useRef(new Map<string, ResolvedWikiRef[]>())

    React.useEffect(() => {
        resolveCacheRef.current.clear()
        inspectCacheRef.current.clear()
    }, [refCatalog])

    const resolveRefs = React.useCallback((src: string) => {
        const key = String(src ?? '')
        const cached = resolveCacheRef.current.get(key)
        if (cached !== undefined) return cached
        const resolved = resolveRefsInText(key, refCatalog)
        resolveCacheRef.current.set(key, resolved)
        return resolved
    }, [refCatalog])

    const inspectRefs = React.useCallback((src: string): ResolvedWikiRef[] => {
        const key = String(src ?? '')
        const cached = inspectCacheRef.current.get(key)
        if (cached) return cached
        const resolved = inspectWikiRefs(key, refCatalog)
        inspectCacheRef.current.set(key, resolved)
        return resolved
    }, [refCatalog])

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
