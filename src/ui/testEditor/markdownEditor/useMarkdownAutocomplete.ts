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
import { buildAutocompleteIndex } from './autocompleteIndex'
import { getCaretAnchor } from './editorGeometry'
import type { SharedMarkdownReferenceData } from './MarkdownReferenceDataContext'
import type { RefShared, RefTest } from './types'

type Translate = (key: string, params?: Record<string, string | number>) => string
type ResolveDisplayText = (source: string | undefined) => string

type UseMarkdownAutocompleteOptions = {
    value: string
    allTests: RefTest[]
    sharedSteps: RefShared[]
    t: Translate
    taRef: React.MutableRefObject<HTMLTextAreaElement | null>
    sharedReferenceData?: SharedMarkdownReferenceData | null
    applyNativeEdit(
        from: number,
        to: number,
        nextText: string,
        selectionStart?: number,
        selectionEnd?: number
    ): string | null
}

function resolveSuggestionText(
    catalog: ReturnType<typeof buildRefCatalog>,
    source: string | undefined
) {
    return toPreviewishPlainText(renderRefsInText(String(source ?? ''), catalog, { mode: 'plain' }))
}

function createAutocompleteIndexGetter(
    sharedReferenceData: SharedMarkdownReferenceData | null | undefined,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    resolveDisplayText: ResolveDisplayText
) {
    if (sharedReferenceData) return () => sharedReferenceData.getAutocompleteIndex()

    let localIndex: ReturnType<typeof buildAutocompleteIndex> | null = null
    return () => {
        if (!localIndex) localIndex = buildAutocompleteIndex(allTests, sharedSteps, resolveDisplayText)
        return localIndex
    }
}

export function useMarkdownAutocomplete({
    value,
    allTests,
    sharedSteps,
    t,
    taRef,
    sharedReferenceData,
    applyNativeEdit,
}: UseMarkdownAutocompleteOptions) {
    const [open, setOpen] = React.useState(false)
    const [items, setItems] = React.useState<AutoItem[]>([])
    const [index, setIndex] = React.useState(0)
    const [stage, setStage] = React.useState<AutoStage>('owner')
    const [horizontalScroll, setHorizontalScroll] = React.useState(0)
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [range, setRange] = React.useState<{ from: number; to: number } | null>(null)

    const sameItems = React.useCallback((left: AutoItem[], right: AutoItem[]) => {
        if (left === right) return true
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index += 1) {
            const a = left[index]
            const b = right[index]
            if (
                a.label !== b.label ||
                a.detail !== b.detail ||
                a.insert !== b.insert ||
                a.stage !== b.stage ||
                a.continues !== b.continues ||
                a.muted !== b.muted
            ) {
                return false
            }
        }
        return true
    }, [])

    const suggestionCatalog = React.useMemo(
        () => sharedReferenceData?.refCatalog ?? buildRefCatalog(allTests as never[], sharedSteps as never[]),
        [allTests, sharedReferenceData, sharedSteps]
    )

    const resolveDisplayText = React.useCallback(
        (source: string | undefined) => resolveSuggestionText(suggestionCatalog, source),
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

    const updateSuggestions = React.useCallback((element: HTMLTextAreaElement, text = value, caretOverride?: number) => {
        const caret = caretOverride ?? element.selectionStart
        const before = text.slice(0, caret)
        const start = before.lastIndexOf('[[')
        const close = before.lastIndexOf(']]')

        if (start === -1 || (close !== -1 && close > start)) {
            setOpen((current) => (current ? false : current))
            setRange((current) => (current ? null : current))
            return
        }

        const query = before.slice(start + 2)
        const caretAnchor = getCaretAnchor(element)
        const menuWidth = 380
        const menuHeight = 260
        const gutter = 12
        const fallbackRect = element.getBoundingClientRect()
        const minLeft = gutter
        const maxLeft = Math.max(minLeft, window.innerWidth - menuWidth - gutter)
        const left = caretAnchor
            ? Math.max(minLeft, Math.min(caretAnchor.left, maxLeft))
            : fallbackRect.left + 8
        const top = caretAnchor
            ? (
                caretAnchor.bottom + menuHeight + gutter <= window.innerHeight
                    ? caretAnchor.bottom + 6
                    : Math.max(gutter, caretAnchor.top - menuHeight - 6)
            )
            : fallbackRect.bottom

        setAnchor((current) => (
            current && current.top === top && current.left === left
                ? current
                : { top, left }
        ))
        setRange((current) => (
            current && current.from === start && current.to === caret
                ? current
                : { from: start, to: caret }
        ))

        const hashPos = query.indexOf('#')
        let nextStage: AutoStage = 'owner'
        let nextItems: AutoItem[] = []

        if (hashPos === -1) {
            nextStage = 'owner'
            nextItems = makeOwnerSuggestions(getAutocompleteIndex(), query.trim(), t)
        } else {
            const ownerQuery = query.slice(0, hashPos).trim()
            const afterHash = query.slice(hashPos + 1)
            const dotPos = afterHash.indexOf('.')
            const atPos = afterHash.indexOf('@')

            if (dotPos === -1) {
                nextStage = 'step'
                nextItems = makeStepSuggestions(ownerQuery, afterHash.trim(), getAutocompleteIndex(), t)
            } else if (atPos === -1) {
                nextStage = 'field'
                nextItems = makeFieldSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1).trim(),
                    getAutocompleteIndex(),
                    t
                )
            } else {
                nextStage = 'part'
                nextItems = makePartSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1, atPos).trim(),
                    afterHash.slice(atPos + 1).trim(),
                    getAutocompleteIndex(),
                    t
                )
            }
        }

        setStage((current) => (current === nextStage ? current : nextStage))
        setItems((current) => (sameItems(current, nextItems) ? current : nextItems))
        setIndex((current) => (current === 0 ? current : 0))
        setHorizontalScroll((current) => (current === 0 ? current : 0))
        setOpen((current) => (current === (nextItems.length > 0) ? current : nextItems.length > 0))
    }, [getAutocompleteIndex, sameItems, t, value])

    const applySuggestion = React.useCallback((item: AutoItem) => {
        const element = taRef.current
        if (!element || !range) return

        const continueSelection = Boolean(item.continues)
        const trailing = value.slice(range.to)
        const trimmedTrailing = trailing.replace(/^\]\]+/, '')
        const trimmedCount = trailing.length - trimmedTrailing.length
        const inserted = `[[${item.insert}]]`
        const leftLength = range.from
        const nextCaret = continueSelection ? leftLength + 2 + item.insert.length : leftLength + inserted.length
        const nextValue = applyNativeEdit(range.from, range.to + trimmedCount, inserted, nextCaret, nextCaret) ?? value

        requestAnimationFrame(() => {
            element.focus()
            if (continueSelection) {
                updateSuggestions(element, nextValue, nextCaret)
            } else {
                setOpen(false)
            }
        })
    }, [applyNativeEdit, range, taRef, updateSuggestions, value])

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
            setOpen(false)
        }
    }, [applySuggestion, index, items, open])

    const handleCursorActivity = React.useCallback(() => {
        const element = taRef.current
        if (element) updateSuggestions(element)
    }, [taRef, updateSuggestions])

    return {
        open,
        items,
        index,
        stage,
        horizontalScroll,
        anchor,
        closeAutocomplete,
        updateSuggestions,
        applySuggestion,
        handleKeyDown,
        handleCursorActivity,
    }
}
