import * as React from 'react'
import { AutocompleteBox } from './AutocompleteBox'
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

    function onChangeWrapped(event: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(event.target.value)
        updateSuggestions(event.target, event.target.value)
    }

    function onKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (acOpen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(event.key)) return
        handleCursorActivity()
    }

    const richPreviewEdit = preview && editInPreview && looksLikeHtml(value)
    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])
    const previewHtml = React.useMemo(() => {
        if (richPreviewEdit) return sanitizeHtml(value)
        return renderPreviewHtml(value)
    }, [renderPreviewHtml, richPreviewEdit, value])

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
    }, [previewHtml, richPreviewEdit])

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
                visible={!hideToolbar && active && !richPreviewEdit}
                preview={preview}
                t={t}
                onWrap={doWrap}
                onInsertPrefix={doInsertPrefix}
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
                        }}
                        onBlur={() => {
                            setActive(false)
                            onActivateApi?.(null)
                            closeAutocomplete()
                            const element = richEditRef.current
                            if (!element) return
                            const sanitized = sanitizeHtml(element.innerHTML)
                            if (sanitized !== value) onChange(sanitized)
                            if (element.innerHTML !== sanitized) element.innerHTML = sanitized
                            richSyncedHtmlRef.current = sanitized
                            richSelectionRef.current = null
                        }}
                        onInput={() => {
                            const element = richEditRef.current
                            if (!element) return
                            const sanitized = sanitizeHtml(element.innerHTML)
                            richSyncedHtmlRef.current = sanitized
                            richSelectionRef.current = getSelectionOffsets(element)
                            onChange(sanitized)
                            syncHeights()
                        }}
                        onMouseUp={() => {
                            const element = richEditRef.current
                            if (!element) return
                            richSelectionRef.current = getSelectionOffsets(element)
                        }}
                        onKeyUp={() => syncHeights()}
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
            </div>

            <MarkdownRefStrip refs={refs} t={t} onOpenRef={onOpenRef} />
        </div>
    )
}

export default MarkdownEditor
