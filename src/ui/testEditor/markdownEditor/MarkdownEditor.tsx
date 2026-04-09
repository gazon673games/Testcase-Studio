import * as React from 'react'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { AutocompleteBox } from './AutocompleteBox'
import { makeFieldSuggestions, makeOwnerSuggestions, makePartSuggestions, makeStepSuggestions, toPreviewishPlainText, type AutoItem, type AutoStage } from './autocomplete'
import { buildAutocompleteIndex, type AutocompleteIndex } from './autocompleteIndex'
import { looksLikeHtml, mdToHtml, normalizeImageWikiRefs, sanitizeHtml } from './previewRendering'
import type { MarkdownEditorProps } from './types'
import { useMarkdownEditorApi } from './useMarkdownEditorApi'
import { useMarkdownAutocomplete } from './useMarkdownAutocomplete'
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar'
import { MarkdownRefStrip } from './MarkdownRefStrip'
import './MarkdownEditor.css'
import { useUiPreferences } from '../../preferences'

export type { MarkdownEditorApi } from './types'

type SelectionOffsets = {
    start: number
    end: number
}

const INTERNAL_RICH_CLIPBOARD_TYPE = 'application/x-testcase-studio-rich-html'

function getSelectionOffsets(root: HTMLElement): SelectionOffsets | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null

    const startRange = range.cloneRange()
    startRange.selectNodeContents(root)
    startRange.setEnd(range.startContainer, range.startOffset)

    const endRange = range.cloneRange()
    endRange.selectNodeContents(root)
    endRange.setEnd(range.endContainer, range.endOffset)

    return {
        start: startRange.toString().length,
        end: endRange.toString().length,
    }
}

function resolveSelectionPosition(root: HTMLElement, targetOffset: number) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let remaining = Math.max(0, targetOffset)
    let current = walker.nextNode()

    while (current) {
        const text = current.textContent ?? ''
        if (remaining <= text.length) {
            return {
                node: current,
                offset: remaining,
            }
        }
        remaining -= text.length
        current = walker.nextNode()
    }

    return {
        node: root,
        offset: root.childNodes.length,
    }
}

function restoreSelectionOffsets(root: HTMLElement, offsets: SelectionOffsets | null) {
    if (!offsets) return
    const selection = window.getSelection()
    if (!selection) return

    const start = resolveSelectionPosition(root, offsets.start)
    const end = resolveSelectionPosition(root, offsets.end)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)

    selection.removeAllRanges()
    selection.addRange(range)
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function plainTextToHtml(value: string) {
    return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

function htmlToPlainText(html: string) {
    const container = document.createElement('div')
    container.innerHTML = html

    for (const br of Array.from(container.querySelectorAll('br'))) {
        br.replaceWith('\n')
    }

    for (const element of Array.from(container.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,pre'))) {
        element.append(document.createTextNode('\n'))
    }

    return (container.textContent ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd()
}

function insertHtmlAtSelection(root: HTMLElement, html: string) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return false

    const template = document.createElement('template')
    template.innerHTML = html
    const fragment = template.content
    const lastNode = fragment.lastChild

    range.deleteContents()
    range.insertNode(fragment)

    if (lastNode) {
        const nextRange = document.createRange()
        nextRange.setStartAfter(lastNode)
        nextRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(nextRange)
    }

    return true
}

function getSelectedRichClipboardData(root: HTMLElement) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null

    const container = document.createElement('div')
    container.appendChild(range.cloneContents())
    const html = sanitizeHtml(container.innerHTML)
    const text = htmlToPlainText(html)

    if (!html && !text) return null
    return { html, text }
}

let lastRichClipboard: { html: string; text: string; capturedAt: number } | null = null

function storeRichClipboardSelection(root: HTMLElement) {
    const payload = getSelectedRichClipboardData(root)
    if (!payload) return
    lastRichClipboard = {
        ...payload,
        capturedAt: Date.now(),
    }
}

function getFallbackRichClipboard(text: string) {
    if (!lastRichClipboard) return null
    if (Date.now() - lastRichClipboard.capturedAt > 60_000) return null
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
    if (normalize(text) !== normalize(lastRichClipboard.text)) return null
    return lastRichClipboard
}

function getClipboardRichHtmlPayload(clipboardData: DataTransfer | null) {
    if (!clipboardData) return null

    const internalHtml = clipboardData.getData(INTERNAL_RICH_CLIPBOARD_TYPE)
    const html = clipboardData.getData('text/html')
    const text = clipboardData.getData('text/plain')
    const fallback = !internalHtml && !html ? getFallbackRichClipboard(text) : null

    const payload = internalHtml
        ? sanitizeHtml(internalHtml)
        : html
            ? sanitizeHtml(html)
            : fallback?.html
                ? sanitizeHtml(fallback.html)
                : null

    if (!payload) return null
    return {
        html: payload,
        text,
    }
}

function resolveAutocompleteState(
    text: string,
    caret: number,
    autocompleteIndex: AutocompleteIndex,
    t: (key: string, params?: Record<string, string | number>) => string
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

function getContentEditableCaret(root: HTMLElement) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null

    const beforeRange = range.cloneRange()
    beforeRange.selectNodeContents(root)
    beforeRange.setEnd(range.endContainer, range.endOffset)

    const caret = beforeRange.toString().length
    const rect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const fallbackTop = rootRect.top + 24
    const fallbackLeft = rootRect.left + 12

    return {
        caret,
        anchor: {
            top: rect.top || fallbackTop,
            left: rect.left || fallbackLeft,
            bottom: rect.bottom || fallbackTop + 18,
        },
    }
}

function getContentEditablePlainText(root: HTMLElement) {
    return root.innerText.replace(/\r\n/g, '\n')
}

function replaceRichTextRange(root: HTMLElement, from: number, to: number, text: string) {
    const start = resolveSelectionPosition(root, from)
    const end = resolveSelectionPosition(root, to)
    const selection = window.getSelection()
    if (!selection) return false

    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    selection.removeAllRanges()
    selection.addRange(range)

    return insertHtmlAtSelection(root, escapeHtml(text))
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const { t } = useUiPreferences()
    const {
        value,
        onChange,
        placeholder,
        rows = 3,
        preview = false,
        editInPreview = false,
        onTogglePreview,
        resolveRefs,
        inspectRefs,
        onOpenRef,
        allTests = [],
        sharedSteps = [],
        apiRef,
        onActivateApi,
        hideToolbar = false,
        className = '',
    } = props

    const taRef = React.useRef<HTMLTextAreaElement | null>(null)
    const previewRef = React.useRef<HTMLDivElement | null>(null)
    const richEditRef = React.useRef<HTMLDivElement | null>(null)
    const richSyncedHtmlRef = React.useRef('')
    const richSelectionRef = React.useRef<SelectionOffsets | null>(null)
    const measurerRef = React.useRef<HTMLDivElement | null>(null)
    const [active, setActive] = React.useState(false)
    const [richAutocompleteOpen, setRichAutocompleteOpen] = React.useState(false)
    const [richAutocompleteItems, setRichAutocompleteItems] = React.useState<AutoItem[]>([])
    const [richAutocompleteIndex, setRichAutocompleteIndex] = React.useState(0)
    const [richAutocompleteStage, setRichAutocompleteStage] = React.useState<AutoStage>('owner')
    const [richAutocompleteHorizontalScroll, setRichAutocompleteHorizontalScroll] = React.useState(0)
    const [richAutocompleteAnchor, setRichAutocompleteAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [richAutocompleteRange, setRichAutocompleteRange] = React.useState<{ from: number; to: number } | null>(null)

    const {
        editorApi,
        applyNativeEdit,
        doWrap,
        doInsertPrefix,
    } = useMarkdownEditorApi({
        value,
        onChange,
        taRef,
        apiRef,
    })

    const renderPreviewHtml = React.useCallback((input: string) => {
        const resolved = typeof resolveRefs === 'function' ? resolveRefs(input ?? '') : (input ?? '')
        return looksLikeHtml(resolved)
            ? sanitizeHtml(resolved)
            : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))
    }, [resolveRefs])

    const richSuggestionCatalog = React.useMemo(
        () => buildRefCatalog(allTests as never[], sharedSteps as never[]),
        [allTests, sharedSteps]
    )
    const richResolveDisplayText = React.useCallback(
        (source: string | undefined) => toPreviewishPlainText(renderRefsInText(String(source ?? ''), richSuggestionCatalog, { mode: 'plain' })),
        [richSuggestionCatalog]
    )
    const richAutocompleteIndexData = React.useMemo(
        () => buildAutocompleteIndex(allTests, sharedSteps, richResolveDisplayText),
        [allTests, richResolveDisplayText, sharedSteps]
    )

    const syncHeights = React.useCallback(() => {
        const previewElement = previewRef.current
        const measurer = measurerRef.current
        const richElement = richEditRef.current
        const textarea = taRef.current

        if (measurer) measurer.offsetHeight

        const shouldMeasureRichEditor = !!richElement && (!textarea || (preview && editInPreview && looksLikeHtml(value)))

        if (shouldMeasureRichEditor && richElement) {
            richElement.style.height = 'auto'
            const richHeight = richElement.scrollHeight
            const previewHeight = measurer?.scrollHeight ?? 0
            const targetHeight = Math.max(richHeight, previewHeight)
            richElement.style.height = `${targetHeight}px`
            richElement.style.overflow = 'hidden'
            return
        }

        if (!textarea) return

        textarea.style.height = 'auto'
        if (previewElement) previewElement.style.height = 'auto'

        const textHeight = textarea.scrollHeight
        const previewHeight = measurer?.scrollHeight ?? 0
        const targetHeight = preview ? Math.max(textHeight, previewHeight) : textHeight

        textarea.style.overflow = 'hidden'
        textarea.style.height = `${targetHeight}px`

        if (previewElement) {
            previewElement.style.height = `${targetHeight}px`
            previewElement.style.overflow = 'hidden'
        }
    }, [editInPreview, preview, value])

    const syncRichEditorValue = React.useCallback(() => {
        const element = richEditRef.current
        if (!element) return
        const selection = getSelectionOffsets(element) ?? richSelectionRef.current
        const sanitized = sanitizeHtml(element.innerHTML)
        if (element.innerHTML !== sanitized) {
            element.innerHTML = sanitized
            restoreSelectionOffsets(element, selection)
        }
        richSyncedHtmlRef.current = sanitized
        richSelectionRef.current = getSelectionOffsets(element) ?? selection
        onChange(sanitized)
        syncHeights()
    }, [onChange, syncHeights])

    const execRichCommand = React.useCallback((command: string, commandValue?: string) => {
        const element = richEditRef.current
        if (!element) return
        element.focus()
        try {
            document.execCommand(command, false, commandValue)
        } catch {
            return
        }
        syncRichEditorValue()
    }, [syncRichEditorValue])

    const doRichWrap = React.useCallback((before: string, after: string) => {
        const element = richEditRef.current
        if (!element) return

        if (before === '**' && after === '**') {
            execRichCommand('bold')
            return
        }
        if (before === '*' && after === '*') {
            execRichCommand('italic')
            return
        }
        if (before === '__' && after === '__') {
            execRichCommand('underline')
            return
        }
        if (before === '`' && after === '`') {
            const selection = window.getSelection()
            const selectedText = selection?.toString() ?? ''
            const content = `<code>${escapeHtml(selectedText)}</code>`
            element.focus()
            if (insertHtmlAtSelection(element, content)) syncRichEditorValue()
            return
        }
        if (before === '[' && after === '](url)') {
            execRichCommand('createLink', 'url')
            return
        }
        if (before === '![' && after === '](image.png)') {
            element.focus()
            if (insertHtmlAtSelection(element, '<img src="image.png" alt="" />')) syncRichEditorValue()
            return
        }
    }, [execRichCommand, syncRichEditorValue])

    const doRichInsertPrefix = React.useCallback((prefix: string) => {
        if (prefix === '-') {
            execRichCommand('insertUnorderedList')
            return
        }
        if (prefix === '1.') {
            execRichCommand('insertOrderedList')
        }
    }, [execRichCommand])

    const closeRichAutocomplete = React.useCallback(() => {
        setRichAutocompleteOpen(false)
        setRichAutocompleteRange(null)
    }, [])

    const updateRichAutocomplete = React.useCallback(() => {
        const element = richEditRef.current
        if (!element) return
        const caretState = getContentEditableCaret(element)
        if (!caretState) {
            closeRichAutocomplete()
            return
        }

        const resolved = resolveAutocompleteState(
            getContentEditablePlainText(element),
            caretState.caret,
            richAutocompleteIndexData,
            t
        )

        if (!resolved) {
            closeRichAutocomplete()
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

        setRichAutocompleteAnchor({ top, left })
        setRichAutocompleteRange(resolved.range)
        setRichAutocompleteStage(resolved.stage)
        setRichAutocompleteItems(resolved.items)
        setRichAutocompleteIndex(0)
        setRichAutocompleteHorizontalScroll(0)
        setRichAutocompleteOpen(true)
    }, [closeRichAutocomplete, richAutocompleteIndexData, t])

    const applyRichSuggestion = React.useCallback((item: AutoItem) => {
        const element = richEditRef.current
        if (!element || !richAutocompleteRange) return

        const trailingText = getContentEditablePlainText(element).slice(richAutocompleteRange.to)
        const trimmedTrailing = trailingText.replace(/^\]\]+/, '')
        const trimmedCount = trailingText.length - trimmedTrailing.length
        const inserted = `[[${item.insert}]]`
        const nextCaret = item.continues
            ? richAutocompleteRange.from + 2 + item.insert.length
            : richAutocompleteRange.from + inserted.length

        element.focus()
        if (!replaceRichTextRange(element, richAutocompleteRange.from, richAutocompleteRange.to + trimmedCount, inserted)) return
        syncRichEditorValue()
        restoreSelectionOffsets(element, { start: nextCaret, end: nextCaret })
        richSelectionRef.current = { start: nextCaret, end: nextCaret }

        requestAnimationFrame(() => {
            if (item.continues) updateRichAutocomplete()
            else closeRichAutocomplete()
        })
    }, [closeRichAutocomplete, richAutocompleteRange, syncRichEditorValue, updateRichAutocomplete])

    React.useEffect(() => {
        const onResize = () => syncHeights()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [syncHeights])

    React.useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => syncHeights())
        const nodes = [measurerRef.current, previewRef.current, richEditRef.current].filter(Boolean)
        for (const node of nodes) observer.observe(node as Element)
        return () => observer.disconnect()
    }, [preview, syncHeights])

    const {
        open: acOpen,
        items: acItems,
        index: acIndex,
        stage: acStage,
        horizontalScroll: acHorizontalScroll,
        anchor,
        closeAutocomplete,
        updateSuggestions,
        applySuggestion,
        handleKeyDown,
        handleCursorActivity,
    } = useMarkdownAutocomplete({
        value,
        allTests,
        sharedSteps,
        t,
        taRef,
        applyNativeEdit,
    })

    React.useEffect(() => {
        if (!preview || editInPreview) return
        taRef.current?.blur()
        closeAutocomplete()
    }, [closeAutocomplete, editInPreview, preview])

    const richPreviewEdit = preview && editInPreview && looksLikeHtml(value)

    React.useEffect(() => {
        if (richPreviewEdit) return
        closeRichAutocomplete()
    }, [closeRichAutocomplete, richPreviewEdit])

    function onChangeWrapped(event: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(event.target.value)
        updateSuggestions(event.target, event.target.value)
    }

    function onKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (acOpen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(event.key)) return
        handleCursorActivity()
    }

    function onTextareaPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
        if (!preview || !editInPreview) return

        const element = taRef.current
        if (!element) return

        const richPayload = getClipboardRichHtmlPayload(event.clipboardData)
        if (!richPayload?.html) return

        event.preventDefault()

        const start = Math.min(element.selectionStart, element.selectionEnd)
        const end = Math.max(element.selectionStart, element.selectionEnd)
        const nextCaret = start + richPayload.html.length
        const nextValue = applyNativeEdit(start, end, richPayload.html, nextCaret, nextCaret)

        if (typeof nextValue === 'string') {
            updateSuggestions(element, nextValue)
        }
    }

    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])
    const previewHtml = React.useMemo(() => {
        if (richPreviewEdit) return sanitizeHtml(value)
        return renderPreviewHtml(value)
    }, [renderPreviewHtml, richPreviewEdit, value])

    React.useLayoutEffect(() => {
        syncHeights()
        const frame = requestAnimationFrame(() => syncHeights())
        return () => cancelAnimationFrame(frame)
    }, [preview, previewHtml, richPreviewEdit, syncHeights, value])

    React.useLayoutEffect(() => {
        if (!richPreviewEdit) return
        const element = richEditRef.current
        if (!element) return
        const selection = document.activeElement === element
            ? (getSelectionOffsets(element) ?? richSelectionRef.current)
            : null
        if (previewHtml === richSyncedHtmlRef.current) return
        if (element.innerHTML !== previewHtml) element.innerHTML = previewHtml
        richSyncedHtmlRef.current = previewHtml
        restoreSelectionOffsets(element, selection)
        syncHeights()
    }, [previewHtml, richPreviewEdit, syncHeights])

    React.useEffect(() => {
        if (!richPreviewEdit || !active) return
        const frame = requestAnimationFrame(() => {
            const element = richEditRef.current
            if (!element) return
            element.focus()
            if (!element.textContent?.trim()) return
            if (!richSelectionRef.current) {
                const end = element.innerText.length
                restoreSelectionOffsets(element, { start: end, end })
                richSelectionRef.current = { start: end, end }
            }
            syncHeights()
        })
        return () => cancelAnimationFrame(frame)
    }, [active, richPreviewEdit, syncHeights, value])

    React.useEffect(() => {
        if (richPreviewEdit) return
        richSyncedHtmlRef.current = ''
        richSelectionRef.current = null
    }, [richPreviewEdit])

    React.useEffect(() => {
        if (!richPreviewEdit) return
        const onSelectionChange = () => {
            const element = richEditRef.current
            if (!element) return
            const offsets = getSelectionOffsets(element)
            if (offsets) richSelectionRef.current = offsets
        }

        document.addEventListener('selectionchange', onSelectionChange)
        return () => document.removeEventListener('selectionchange', onSelectionChange)
    }, [richPreviewEdit])

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${richPreviewEdit ? 'is-rich-preview-edit' : ''} ${className}`}>
            <MarkdownEditorToolbar
                visible={!hideToolbar && active}
                preview={preview}
                t={t}
                onWrap={richPreviewEdit ? doRichWrap : doWrap}
                onInsertPrefix={richPreviewEdit ? doRichInsertPrefix : doInsertPrefix}
                onTogglePreview={onTogglePreview}
            />
            <div className="md-input-wrap">
                {!richPreviewEdit && (
                    <>
                        <div
                            ref={measurerRef}
                            className="md-preview measurer"
                            aria-hidden
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />

                        <textarea
                            ref={taRef}
                            value={value}
                            onChange={onChangeWrapped}
                            onPaste={onTextareaPaste}
                            onKeyDown={handleKeyDown}
                            onKeyUp={onKeyUp}
                            onClick={handleCursorActivity}
                            onFocus={() => {
                                setActive(true)
                                onActivateApi?.(editorApi)
                                const el = taRef.current
                                if (el) updateSuggestions(el)
                            }}
                            onBlur={() => {
                                setActive(false)
                                onActivateApi?.(null)
                                closeAutocomplete()
                            }}
                            placeholder={placeholder}
                            rows={rows}
                            className={`md-textarea ${preview && editInPreview ? 'md-textarea--preview-edit' : ''} ${preview && editInPreview && active ? 'md-textarea--preview-edit-active' : ''}`}
                            wrap="soft"
                            aria-hidden={preview && !editInPreview}
                            tabIndex={preview && !editInPreview ? -1 : 0}
                        />
                    </>
                )}

                {richPreviewEdit ? (
                    <div
                        ref={richEditRef}
                        className="md-preview md-rich-editor"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        data-placeholder={placeholder ?? ''}
                        onFocus={() => {
                            setActive(true)
                            onActivateApi?.(null)
                            closeAutocomplete()
                            const element = richEditRef.current
                            if (!element) return
                            richSelectionRef.current = getSelectionOffsets(element) ?? richSelectionRef.current
                            updateRichAutocomplete()
                        }}
                        onBlur={() => {
                            setActive(false)
                            onActivateApi?.(null)
                            closeAutocomplete()
                            closeRichAutocomplete()
                            const element = richEditRef.current
                            if (!element) return
                            const sanitized = sanitizeHtml(element.innerHTML)
                            if (sanitized !== value) onChange(sanitized)
                            if (element.innerHTML !== sanitized) element.innerHTML = sanitized
                            richSyncedHtmlRef.current = sanitized
                            richSelectionRef.current = null
                        }}
                        onInput={() => {
                            syncRichEditorValue()
                            updateRichAutocomplete()
                        }}
                        onPaste={(event) => {
                            const element = richEditRef.current
                            if (!element) return
                            const richPayload = getClipboardRichHtmlPayload(event.clipboardData)
                            const text = event.clipboardData.getData('text/plain')
                            const payload = richPayload?.html ?? plainTextToHtml(text)
                            if (!payload) return
                            event.preventDefault()
                            element.focus()
                            if (insertHtmlAtSelection(element, payload)) syncRichEditorValue()
                        }}
                        onCopy={(event) => {
                            const element = richEditRef.current
                            if (!element) return
                            const payload = getSelectedRichClipboardData(element)
                            if (!payload) return
                            lastRichClipboard = {
                                ...payload,
                                capturedAt: Date.now(),
                            }
                            event.preventDefault()
                            event.clipboardData.setData(INTERNAL_RICH_CLIPBOARD_TYPE, payload.html)
                            event.clipboardData.setData('text/html', payload.html)
                            event.clipboardData.setData('text/plain', payload.text)
                        }}
                        onCut={(event) => {
                            const element = richEditRef.current
                            if (!element) return
                            storeRichClipboardSelection(element)
                        }}
                        onMouseUp={() => {
                            const element = richEditRef.current
                            if (!element) return
                            richSelectionRef.current = getSelectionOffsets(element)
                            updateRichAutocomplete()
                        }}
                        onKeyUp={() => {
                            syncHeights()
                            updateRichAutocomplete()
                        }}
                        onKeyDown={(event) => {
                            if (!richAutocompleteOpen) return

                            if (event.key === 'ArrowDown') {
                                event.preventDefault()
                                setRichAutocompleteIndex((current) => Math.min(current + 1, richAutocompleteItems.length - 1))
                                setRichAutocompleteHorizontalScroll(0)
                                return
                            }

                            if (event.key === 'ArrowUp') {
                                event.preventDefault()
                                setRichAutocompleteIndex((current) => Math.max(current - 1, 0))
                                setRichAutocompleteHorizontalScroll(0)
                                return
                            }

                            if (event.key === 'ArrowRight') {
                                event.preventDefault()
                                setRichAutocompleteHorizontalScroll((current) => current + 48)
                                return
                            }

                            if (event.key === 'ArrowLeft') {
                                event.preventDefault()
                                setRichAutocompleteHorizontalScroll((current) => Math.max(0, current - 48))
                                return
                            }

                            if (event.key === 'Enter' || event.key === 'Tab') {
                                event.preventDefault()
                                const pickedItem = richAutocompleteItems[richAutocompleteIndex]
                                if (pickedItem) applyRichSuggestion(pickedItem)
                                return
                            }

                            if (event.key === 'Escape') {
                                event.preventDefault()
                                closeRichAutocomplete()
                            }
                        }}
                    />
                ) : preview ? (
                    <div
                        ref={previewRef}
                        className={`md-preview ${editInPreview ? 'md-preview--editable' : ''} ${editInPreview && active ? 'md-preview--editing' : ''}`}
                        tabIndex={editInPreview ? -1 : 0}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                ) : null}

                {acOpen && anchor && !richPreviewEdit && (
                    <AutocompleteBox
                        top={anchor.top}
                        left={anchor.left}
                        stage={acStage}
                        stageLabel={t(`markdown.stage.${acStage}`)}
                        emptyLabel={t('markdown.noMatches')}
                        items={acItems}
                        index={acIndex}
                        horizontalScroll={acHorizontalScroll}
                        onPick={applySuggestion}
                        onClose={closeAutocomplete}
                    />
                )}
                {richPreviewEdit && richAutocompleteOpen && richAutocompleteAnchor ? (
                    <AutocompleteBox
                        top={richAutocompleteAnchor.top}
                        left={richAutocompleteAnchor.left}
                        stage={richAutocompleteStage}
                        stageLabel={t(`markdown.stage.${richAutocompleteStage}`)}
                        emptyLabel={t('markdown.noMatches')}
                        items={richAutocompleteItems}
                        index={richAutocompleteIndex}
                        horizontalScroll={richAutocompleteHorizontalScroll}
                        onPick={applyRichSuggestion}
                        onClose={closeRichAutocomplete}
                    />
                ) : null}
            </div>

            <MarkdownRefStrip refs={refs} t={t} onOpenRef={onOpenRef} />
        </div>
    )
}

export default MarkdownEditor
