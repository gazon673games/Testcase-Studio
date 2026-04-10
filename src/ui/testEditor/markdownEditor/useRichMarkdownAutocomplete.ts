import * as React from 'react'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import {
    makeFieldSuggestions,
    makeOwnerSuggestions,
    makePartSuggestions,
    makeStepSuggestions,
    toPreviewishPlainText,
    type AutoItem,
    type AutoStage,
} from './autocomplete'
import { buildAutocompleteIndex, type AutocompleteIndex } from './autocompleteIndex'
import type { SharedMarkdownReferenceData } from './MarkdownReferenceDataContext'
import type { RefShared, RefTest } from './types'
import {
    readContentEditableCaret,
    readContentEditablePlainText,
    replaceContentEditableTextRange,
    restoreSelectionOffsets,
    type RichTextSelectionOffsets,
} from './richTextDom'

type Translate = (key: string, params?: Record<string, string | number>) => string

type UseRichMarkdownAutocompleteOptions = {
    allTests: RefTest[]
    sharedSteps: RefShared[]
    t: Translate
    editorRef: React.MutableRefObject<HTMLElement | null>
    selectionRef: React.MutableRefObject<RichTextSelectionOffsets | null>
    sharedReferenceData?: SharedMarkdownReferenceData | null
    syncEditorValue(): void
}

function resolveAutocompleteState(
    text: string,
    caret: number,
    autocompleteIndex: AutocompleteIndex,
    t: Translate
): { items: AutoItem[]; stage: AutoStage; range: { from: number; to: number } } | null {
    const before = text.slice(0, caret)
    const start = before.lastIndexOf('[[')
    const close = before.lastIndexOf(']]')

    if (start === -1 || (close !== -1 && close > start)) return null

    const query = before.slice(start + 2)
    const hashPos = query.indexOf('#')
    let stage: AutoStage = 'owner'
    let items: AutoItem[] = []

    if (hashPos === -1) {
        stage = 'owner'
        items = makeOwnerSuggestions(autocompleteIndex, query.trim(), t)
    } else {
        const ownerQuery = query.slice(0, hashPos).trim()
        const afterHash = query.slice(hashPos + 1)
        const dotPos = afterHash.indexOf('.')
        const atPos = afterHash.indexOf('@')

        if (dotPos === -1) {
            stage = 'step'
            items = makeStepSuggestions(ownerQuery, afterHash.trim(), autocompleteIndex, t)
        } else if (atPos === -1) {
            stage = 'field'
            items = makeFieldSuggestions(
                ownerQuery,
                afterHash.slice(0, dotPos).trim(),
                afterHash.slice(dotPos + 1).trim(),
                autocompleteIndex,
                t
            )
        } else {
            stage = 'part'
            items = makePartSuggestions(
                ownerQuery,
                afterHash.slice(0, dotPos).trim(),
                afterHash.slice(dotPos + 1, atPos).trim(),
                afterHash.slice(atPos + 1).trim(),
                autocompleteIndex,
                t
            )
        }
    }

    if (!items.length) return null
    return {
        items,
        stage,
        range: { from: start, to: caret },
    }
}

function createAutocompleteIndexGetter(
    sharedReferenceData: SharedMarkdownReferenceData | null | undefined,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    resolveDisplayText: (source: string | undefined) => string
) {
    if (sharedReferenceData) return () => sharedReferenceData.getAutocompleteIndex()

    let localIndex: AutocompleteIndex | null = null
    return () => {
        if (!localIndex) localIndex = buildAutocompleteIndex(allTests, sharedSteps, resolveDisplayText)
        return localIndex
    }
}

export function useRichMarkdownAutocomplete({
    allTests,
    sharedSteps,
    t,
    editorRef,
    selectionRef,
    sharedReferenceData,
    syncEditorValue,
}: UseRichMarkdownAutocompleteOptions) {
    const [open, setOpen] = React.useState(false)
    const [items, setItems] = React.useState<AutoItem[]>([])
    const [index, setIndex] = React.useState(0)
    const [stage, setStage] = React.useState<AutoStage>('owner')
    const [horizontalScroll, setHorizontalScroll] = React.useState(0)
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [range, setRange] = React.useState<{ from: number; to: number } | null>(null)

    const suggestionCatalog = React.useMemo(
        () => sharedReferenceData?.refCatalog ?? buildRefCatalog(allTests as never[], sharedSteps as never[]),
        [allTests, sharedReferenceData, sharedSteps]
    )

    const resolveDisplayText = React.useCallback(
        (source: string | undefined) =>
            toPreviewishPlainText(renderRefsInText(String(source ?? ''), suggestionCatalog, { mode: 'plain' })),
        [suggestionCatalog]
    )

    const getAutocompleteIndex = React.useMemo(
        () => createAutocompleteIndexGetter(sharedReferenceData, allTests, sharedSteps, resolveDisplayText),
        [allTests, resolveDisplayText, sharedReferenceData, sharedSteps]
    )

    const closeAutocomplete = React.useCallback(() => {
        setOpen(false)
        setRange(null)
    }, [])

    const refreshAutocomplete = React.useCallback(() => {
        const element = editorRef.current
        if (!element) return

        const caretState = readContentEditableCaret(element)
        if (!caretState) {
            closeAutocomplete()
            return
        }

        const resolved = resolveAutocompleteState(
            readContentEditablePlainText(element),
            caretState.caret,
            getAutocompleteIndex(),
            t
        )

        if (!resolved) {
            closeAutocomplete()
            return
        }

        const menuWidth = 380
        const menuHeight = 260
        const gutter = 12
        const minLeft = gutter
        const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - gutter)
        const left = Math.max(minLeft, Math.min(caretState.anchor.left, maxLeft))
        const top = caretState.anchor.bottom + menuHeight + gutter <= window.innerHeight
            ? caretState.anchor.bottom + 6
            : Math.max(gutter, caretState.anchor.top - menuHeight - 6)

        setAnchor({ top, left })
        setRange(resolved.range)
        setStage(resolved.stage)
        setItems(resolved.items)
        setIndex(0)
        setHorizontalScroll(0)
        setOpen(true)
    }, [closeAutocomplete, editorRef, getAutocompleteIndex, t])

    const applySuggestion = React.useCallback((item: AutoItem) => {
        const element = editorRef.current
        if (!element || !range) return

        const trailingText = readContentEditablePlainText(element).slice(range.to)
        const trimmedTrailing = trailingText.replace(/^\]\]+/, '')
        const trimmedCount = trailingText.length - trimmedTrailing.length
        const inserted = `[[${item.insert}]]`
        const nextCaret = item.continues
            ? range.from + 2 + item.insert.length
            : range.from + inserted.length

        element.focus()
        if (!replaceContentEditableTextRange(element, range.from, range.to + trimmedCount, inserted)) return
        syncEditorValue()
        restoreSelectionOffsets(element, { start: nextCaret, end: nextCaret })
        selectionRef.current = { start: nextCaret, end: nextCaret }

        requestAnimationFrame(() => {
            if (item.continues) refreshAutocomplete()
            else closeAutocomplete()
        })
    }, [closeAutocomplete, editorRef, range, refreshAutocomplete, selectionRef, syncEditorValue])

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
        if (!open) return

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIndex((current) => Math.min(current + 1, items.length - 1))
            setHorizontalScroll(0)
            return
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            setIndex((current) => Math.max(current - 1, 0))
            setHorizontalScroll(0)
            return
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault()
            setHorizontalScroll((current) => current + 48)
            return
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            setHorizontalScroll((current) => Math.max(0, current - 48))
            return
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            const pickedItem = items[index]
            if (pickedItem) applySuggestion(pickedItem)
            return
        }

        if (event.key === 'Escape') {
            event.preventDefault()
            closeAutocomplete()
        }
    }, [applySuggestion, closeAutocomplete, index, items, open])

    return {
        open,
        items,
        index,
        stage,
        horizontalScroll,
        anchor,
        closeAutocomplete,
        refreshAutocomplete,
        applySuggestion,
        handleKeyDown,
    }
}
