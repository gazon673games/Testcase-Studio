import * as React from 'react'
import { buildRefCatalog, formatResolvedRefBrokenReason, formatResolvedRefLabel, renderRefsInText, type ResolvedWikiRef } from '@core/refs'
import { AutocompleteBox } from './AutocompleteBox'
import {
    makeFieldSuggestions,
    makeOwnerSuggestions,
    makePartSuggestions,
    makeStepSuggestions,
    toPreviewishPlainText,
    trimText,
    type AutoItem,
    type AutoStage,
} from './autocomplete'
import { getCaretAnchor } from './editorGeometry'
import { looksLikeHtml, mdToHtml, normalizeImageWikiRefs, sanitizeHtml } from './previewRendering'
import type { MarkdownEditorApi, MarkdownEditorProps } from './types'
import './MarkdownEditor.css'
import { useUiPreferences } from '../../preferences'

export type { MarkdownEditorApi } from './types'

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
    const measurerRef = React.useRef<HTMLDivElement | null>(null)
    const [active, setActive] = React.useState(false)
    const [hoveredRef, setHoveredRef] = React.useState<ResolvedWikiRef | null>(null)

    const dispatchTextareaInput = React.useCallback((el: HTMLTextAreaElement) => {
        const event =
            typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' })
                : new Event('input', { bubbles: true })
        el.dispatchEvent(event)
    }, [])

    const applyNativeEdit = React.useCallback((
        from: number,
        to: number,
        nextText: string,
        selectionStart?: number,
        selectionEnd?: number
    ) => {
        const el = taRef.current
        if (!el) return null
        el.focus()
        el.setSelectionRange(from, to)

        let usedNativeInsert = false
        try {
            usedNativeInsert =
                typeof document !== 'undefined' &&
                typeof document.execCommand === 'function' &&
                document.execCommand('insertText', false, nextText)
        } catch {
            usedNativeInsert = false
        }

        if (!usedNativeInsert) {
            el.setRangeText(nextText, from, to, 'end')
            dispatchTextareaInput(el)
        }

        if (typeof selectionStart === 'number') {
            el.selectionStart = selectionStart
            el.selectionEnd = typeof selectionEnd === 'number' ? selectionEnd : selectionStart
        }

        return el.value
    }, [dispatchTextareaInput])

    const doWrap = React.useCallback((before: string, after: string) => {
        const el = taRef.current
        if (!el) return
        const start = Math.min(el.selectionStart, el.selectionEnd)
        const end = Math.max(el.selectionStart, el.selectionEnd)
        const mid = value.slice(start, end)
        const inserted = `${before}${mid}${after}`
        const selection = start + inserted.length
        applyNativeEdit(start, end, inserted, selection, selection)
        requestAnimationFrame(() => {
            el.focus()
        })
    }, [applyNativeEdit, value])

    const doInsertPrefix = React.useCallback((prefix: string) => {
        const el = taRef.current
        if (!el) return
        const lines = value.split('\n')
        const start = el.selectionStart
        const end = el.selectionEnd
        let startLine = 0
        let endLine = lines.length - 1

        for (let index = 0, acc = 0; index < lines.length; index += 1, acc += lines[index].length + 1) {
            if (acc + lines[index].length >= start) {
                startLine = index
                break
            }
        }

        for (let index = startLine; index < lines.length; index += 1) {
            const lineStart = lines.slice(0, index).join('\n').length + (index ? 1 : 0)
            const lineEnd = lineStart + lines[index].length
            if (lineEnd >= end) {
                endLine = index
                break
            }
        }

        for (let index = startLine; index <= endLine; index += 1) {
            lines[index] = lines[index].length ? `${prefix} ${lines[index]}` : `${prefix} `
        }

        onChange(lines.join('\n'))
        requestAnimationFrame(() => el.focus())
    }, [onChange, value])

    const doInsertText = React.useCallback((text: string) => {
        const el = taRef.current
        if (!el) return
        const start = Math.min(el.selectionStart, el.selectionEnd)
        const end = Math.max(el.selectionStart, el.selectionEnd)
        const pos = start + text.length
        applyNativeEdit(start, end, text, pos, pos)
        requestAnimationFrame(() => {
            el.focus()
            el.selectionStart = el.selectionEnd = pos
        })
    }, [applyNativeEdit])

    const editorApi = React.useMemo<MarkdownEditorApi>(() => ({
        wrap: doWrap,
        insertPrefix: doInsertPrefix,
        insertText: doInsertText,
        focus: () => taRef.current?.focus(),
    }), [doInsertPrefix, doInsertText, doWrap])

    React.useEffect(() => {
        if (apiRef) apiRef.current = editorApi
        return () => {
            if (apiRef?.current === editorApi) apiRef.current = null
        }
    }, [apiRef, editorApi])

    React.useEffect(() => {
        if (active && onActivateApi) onActivateApi(editorApi)
    }, [active, editorApi, onActivateApi])

    const renderPreviewHtml = React.useCallback((input: string) => {
        const resolved = typeof resolveRefs === 'function' ? resolveRefs(input ?? '') : (input ?? '')
        return looksLikeHtml(resolved)
            ? sanitizeHtml(resolved)
            : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))
    }, [resolveRefs])

    const syncHeights = React.useCallback(() => {
        const textarea = taRef.current
        if (!textarea) return
        const previewElement = previewRef.current

        textarea.style.height = 'auto'
        if (previewElement) previewElement.style.height = 'auto'

        const measurer = measurerRef.current
        if (measurer) measurer.offsetHeight
        const textHeight = textarea.scrollHeight
        const previewHeight = measurer?.scrollHeight ?? 0
        const targetHeight = preview ? Math.max(textHeight, previewHeight) : textHeight

        textarea.style.overflow = 'hidden'
        textarea.style.height = `${targetHeight}px`

        if (previewElement) {
            previewElement.style.height = `${targetHeight}px`
            previewElement.style.overflow = 'hidden'
        }
    }, [preview])

    React.useLayoutEffect(() => {
        syncHeights()
    }, [preview, syncHeights, value])

    React.useEffect(() => {
        const onResize = () => syncHeights()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [syncHeights])

    React.useEffect(() => {
        if (!preview) return
        taRef.current?.blur()
        setAcOpen(false)
    }, [preview])

    const [acOpen, setAcOpen] = React.useState(false)
    const [acItems, setAcItems] = React.useState<AutoItem[]>([])
    const [acIndex, setAcIndex] = React.useState(0)
    const [acStage, setAcStage] = React.useState<AutoStage>('owner')
    const [acHorizontalScroll, setAcHorizontalScroll] = React.useState(0)
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [range, setRange] = React.useState<{ from: number; to: number } | null>(null)

    const suggestionCatalog = React.useMemo(
        () => buildRefCatalog(allTests as unknown as any[], sharedSteps as unknown as any[]),
        [allTests, sharedSteps]
    )

    const resolveSuggestionText = React.useCallback(
        (src: string | undefined) => toPreviewishPlainText(renderRefsInText(String(src ?? ''), suggestionCatalog, { mode: 'plain' })),
        [suggestionCatalog]
    )

    const updateSuggestions = React.useCallback((el: HTMLTextAreaElement, text = value, caretOverride?: number) => {
        const caret = caretOverride ?? el.selectionStart
        const before = text.slice(0, caret)
        const start = before.lastIndexOf('[[')
        const close = before.lastIndexOf(']]')

        if (start === -1 || (close !== -1 && close > start)) {
            setAcOpen(false)
            setRange(null)
            return
        }

        const query = before.slice(start + 2)
        const caretAnchor = getCaretAnchor(el)
        const menuWidth = 380
        const menuHeight = 260
        const gutter = 12
        const fallbackRect = el.getBoundingClientRect()
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

        setAnchor({ top, left })
        setRange({ from: start, to: caret })

        const hashPos = query.indexOf('#')
        let stage: AutoStage = 'owner'
        let items: AutoItem[] = []

        if (hashPos === -1) {
            stage = 'owner'
            items = makeOwnerSuggestions(allTests, sharedSteps, query.trim(), t)
        } else {
            const ownerQuery = query.slice(0, hashPos).trim()
            const afterHash = query.slice(hashPos + 1)
            const dotPos = afterHash.indexOf('.')
            const atPos = afterHash.indexOf('@')

            if (dotPos === -1) {
                stage = 'step'
                items = makeStepSuggestions(ownerQuery, afterHash.trim(), allTests, sharedSteps, t, resolveSuggestionText)
            } else if (atPos === -1) {
                stage = 'field'
                items = makeFieldSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1).trim(),
                    allTests,
                    sharedSteps,
                    t,
                    resolveSuggestionText
                )
            } else {
                stage = 'part'
                items = makePartSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1, atPos).trim(),
                    afterHash.slice(atPos + 1).trim(),
                    allTests,
                    sharedSteps,
                    t,
                    resolveSuggestionText
                )
            }
        }

        setAcStage(stage)
        setAcItems(items)
        setAcIndex(0)
        setAcHorizontalScroll(0)
        setAcOpen(items.length > 0)
    }, [allTests, resolveSuggestionText, sharedSteps, t, value])

    function applySuggestion(item: AutoItem) {
        const el = taRef.current
        if (!el || !range) return
        const continueSelection = Boolean(item.continues)
        const trailing = value.slice(range.to)
        const trimmedTrailing = trailing.replace(/^\]\]+/, '')
        const trimmedCount = trailing.length - trimmedTrailing.length
        const inserted = `[[${item.insert}]]`
        const leftLength = range.from
        const nextCaret = continueSelection ? leftLength + 2 + item.insert.length : leftLength + inserted.length
        const nextValue = applyNativeEdit(range.from, range.to + trimmedCount, inserted, nextCaret, nextCaret) ?? value
        requestAnimationFrame(() => {
            el.focus()
            if (continueSelection) {
                updateSuggestions(el, nextValue, nextCaret)
            } else {
                setAcOpen(false)
            }
        })
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!acOpen) return

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setAcIndex((current) => Math.min(current + 1, acItems.length - 1))
            setAcHorizontalScroll(0)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setAcIndex((current) => Math.max(current - 1, 0))
            setAcHorizontalScroll(0)
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            setAcHorizontalScroll((current) => current + 48)
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            setAcHorizontalScroll((current) => Math.max(0, current - 48))
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            const item = acItems[acIndex]
            if (item) applySuggestion(item)
        } else if (event.key === 'Escape') {
            event.preventDefault()
            setAcOpen(false)
        }
    }

    function onChangeWrapped(event: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(event.target.value)
        updateSuggestions(event.target, event.target.value)
    }

    function onCursorActivity() {
        const el = taRef.current
        if (el) updateSuggestions(el)
    }

    function onKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (acOpen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(event.key)) return
        onCursorActivity()
    }

    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])
    const previewHtml = React.useMemo(() => renderPreviewHtml(value), [renderPreviewHtml, value])

    const toolbar = !hideToolbar && active && !preview ? (
        <div className="md-toolbar" onMouseDown={(event) => event.preventDefault()}>
            <button type="button" className="md-btn" title={t('markdown.bold')} onClick={() => doWrap('**', '**')}>B</button>
            <button type="button" className="md-btn" title={t('markdown.italic')} onClick={() => doWrap('*', '*')}><i>I</i></button>
            <button type="button" className="md-btn" title={t('markdown.underline')} onClick={() => doWrap('__', '__')}><u>U</u></button>
            <div className="divider" />
            <button type="button" className="md-btn" title={t('markdown.bulletedList')} onClick={() => doInsertPrefix('-')}>*</button>
            <button type="button" className="md-btn" title={t('markdown.numberedList')} onClick={() => doInsertPrefix('1.')}>1.</button>
            <div className="divider" />
            <button type="button" className="md-btn" title={t('markdown.code')} onClick={() => doWrap('`', '`')}>{'</>'}</button>
            <button type="button" className="md-btn" title={t('markdown.link')} onClick={() => doWrap('[', '](url)')}>{t('markdown.link')}</button>
            <button type="button" className="md-btn" title={t('markdown.image')} onClick={() => doWrap('![', '](image.png)')}>{t('markdown.image')}</button>
            {typeof onTogglePreview === 'function' && (
                <>
                    <div className="divider" />
                    <button type="button" className="md-btn" title={t('markdown.togglePreview')} onClick={onTogglePreview}>
                        {t('markdown.togglePreview')}
                    </button>
                </>
            )}
        </div>
    ) : null

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${className}`}>
            {toolbar}
            <div className="md-input-wrap">
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
                    onKeyDown={onKeyDown}
                    onKeyUp={onKeyUp}
                    onClick={onCursorActivity}
                    onFocus={() => {
                        setActive(true)
                        onActivateApi?.(editorApi)
                        const el = taRef.current
                        if (el) updateSuggestions(el)
                    }}
                    onBlur={() => {
                        setActive(false)
                        onActivateApi?.(null)
                        setAcOpen(false)
                    }}
                    placeholder={placeholder}
                    rows={rows}
                    className={`md-textarea ${preview && editInPreview ? 'md-textarea--preview-edit' : ''}`}
                    wrap="soft"
                    aria-hidden={preview && !editInPreview}
                    tabIndex={preview && !editInPreview ? -1 : 0}
                />

                {preview && (
                    <div
                        ref={previewRef}
                        className={`md-preview ${editInPreview ? 'md-preview--editable' : ''}`}
                        tabIndex={editInPreview ? -1 : 0}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                )}

                {acOpen && anchor && (
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
                        onClose={() => setAcOpen(false)}
                    />
                )}
            </div>

            {refs.length > 0 && (
                <div className="md-ref-strip">
                    {refs.map((refInfo, index) => (
                        <button
                            key={`${refInfo.raw}-${index}`}
                            type="button"
                            className={`md-ref-pill ${refInfo.ok ? 'ok' : 'broken'}`}
                            onMouseEnter={() => setHoveredRef(refInfo)}
                            onMouseLeave={() => setHoveredRef((current) => (current?.raw === refInfo.raw ? null : current))}
                            onClick={() => {
                                if (refInfo.ok) onOpenRef?.(refInfo)
                            }}
                            title={refInfo.ok ? refInfo.preview : formatResolvedRefBrokenReason(refInfo, t)}
                        >
                            {refInfo.ok
                                ? trimText(formatResolvedRefLabel(refInfo, t), 44)
                                : `${t('markdown.brokenPrefix')}: ${trimText(refInfo.body, 32)}`}
                        </button>
                    ))}
                    {hoveredRef && (
                        <div className={`md-ref-preview ${hoveredRef.ok ? 'ok' : 'broken'}`}>
                            <div className="md-ref-preview-title">
                                {hoveredRef.ok ? formatResolvedRefLabel(hoveredRef, t) : t('steps.brokenLink')}
                            </div>
                            <div className="md-ref-preview-body">
                                {hoveredRef.ok ? hoveredRef.preview : formatResolvedRefBrokenReason(hoveredRef, t)}
                            </div>
                            {hoveredRef.ok && onOpenRef && (
                                <button
                                    type="button"
                                    className="md-ref-open"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => onOpenRef(hoveredRef)}
                                >
                                    {t('markdown.openSource')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default MarkdownEditor
