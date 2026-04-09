import * as React from 'react'
import { AutocompleteBox } from './AutocompleteBox'
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar'
import { MarkdownRefStrip } from './MarkdownRefStrip'
import {
    INTERNAL_RICH_CLIPBOARD_TYPE,
    cacheSelectedRichClipboard,
    readClipboardRichHtmlPayload,
} from './richClipboard'
import {
    insertHtmlAtSelection,
    plainTextToHtml,
    readSelectionOffsets,
    restoreSelectionOffsets,
    type RichTextSelectionOffsets,
} from './richTextDom'
import type { MarkdownEditorProps } from './types'
import { useMarkdownAutocomplete } from './useMarkdownAutocomplete'
import { useMarkdownEditorApi } from './useMarkdownEditorApi'
import { useRichMarkdownAutocomplete } from './useRichMarkdownAutocomplete'
import { escapeHtml, looksLikeHtml, mdToHtml, normalizeImageWikiRefs, sanitizeHtml } from './previewRendering'
import './MarkdownEditor.css'
import { useUiPreferences } from '../../preferences'

export type { MarkdownEditorApi } from './types'

function renderPreviewContent(
    source: string,
    resolveRefs?: (source: string) => string
) {
    const resolved = typeof resolveRefs === 'function' ? resolveRefs(source ?? '') : (source ?? '')
    return looksLikeHtml(resolved)
        ? sanitizeHtml(resolved)
        : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))
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

    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
    const previewRef = React.useRef<HTMLDivElement | null>(null)
    const richEditorRef = React.useRef<HTMLDivElement | null>(null)
    const previewMeasureRef = React.useRef<HTMLDivElement | null>(null)
    const richHtmlRef = React.useRef('')
    const richSelectionRef = React.useRef<RichTextSelectionOffsets | null>(null)

    const [isActive, setIsActive] = React.useState(false)

    const isRichPreviewEditing = preview && editInPreview && looksLikeHtml(value)
    const previewHtml = React.useMemo(
        () => (isRichPreviewEditing ? sanitizeHtml(value) : renderPreviewContent(value, resolveRefs)),
        [isRichPreviewEditing, resolveRefs, value]
    )

    const {
        editorApi,
        applyNativeEdit,
        doWrap,
        doInsertPrefix,
    } = useMarkdownEditorApi({
        value,
        onChange,
        taRef: textareaRef,
        apiRef,
    })

    const syncEditorLayout = React.useCallback(() => {
        const measureElement = previewMeasureRef.current
        if (measureElement) measureElement.offsetHeight

        if (isRichPreviewEditing && richEditorRef.current) {
            const richElement = richEditorRef.current
            richElement.style.height = 'auto'
            const richHeight = richElement.scrollHeight
            const previewHeight = measureElement?.scrollHeight ?? 0
            const targetHeight = Math.max(richHeight, previewHeight)
            richElement.style.height = `${targetHeight}px`
            richElement.style.overflow = 'hidden'
            return
        }

        if (!textareaRef.current) return

        const nextTextarea = textareaRef.current
        nextTextarea.style.height = 'auto'
        if (previewRef.current) previewRef.current.style.height = 'auto'

        const textHeight = nextTextarea.scrollHeight
        const previewHeight = measureElement?.scrollHeight ?? 0
        const targetHeight = preview ? Math.max(textHeight, previewHeight) : textHeight

        nextTextarea.style.overflow = 'hidden'
        nextTextarea.style.height = `${targetHeight}px`

        if (previewRef.current) {
            previewRef.current.style.height = `${targetHeight}px`
            previewRef.current.style.overflow = 'hidden'
        }
    }, [isRichPreviewEditing, preview])

    const syncRichEditorValue = React.useCallback(() => {
        const editorElement = richEditorRef.current
        if (!editorElement) return

        const selection = readSelectionOffsets(editorElement) ?? richSelectionRef.current
        const sanitizedHtml = sanitizeHtml(editorElement.innerHTML)

        if (editorElement.innerHTML !== sanitizedHtml) {
            editorElement.innerHTML = sanitizedHtml
            restoreSelectionOffsets(editorElement, selection)
        }

        richHtmlRef.current = sanitizedHtml
        richSelectionRef.current = readSelectionOffsets(editorElement) ?? selection
        onChange(sanitizedHtml)
        syncEditorLayout()
    }, [onChange, syncEditorLayout])

    const execRichCommand = React.useCallback((command: string, commandValue?: string) => {
        const editorElement = richEditorRef.current
        if (!editorElement) return

        editorElement.focus()
        try {
            document.execCommand(command, false, commandValue)
        } catch {
            return
        }

        syncRichEditorValue()
    }, [syncRichEditorValue])

    const doRichWrap = React.useCallback((before: string, after: string) => {
        const editorElement = richEditorRef.current
        if (!editorElement) return

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
            const selectedText = window.getSelection()?.toString() ?? ''
            editorElement.focus()
            if (insertHtmlAtSelection(editorElement, `<code>${escapeHtml(selectedText)}</code>`)) {
                syncRichEditorValue()
            }
            return
        }
        if (before === '[' && after === '](url)') {
            execRichCommand('createLink', 'url')
            return
        }
        if (before === '![' && after === '](image.png)') {
            editorElement.focus()
            if (insertHtmlAtSelection(editorElement, '<img src="image.png" alt="" />')) {
                syncRichEditorValue()
            }
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

    const {
        open: plainAutocompleteOpen,
        items: plainAutocompleteItems,
        index: plainAutocompleteIndex,
        stage: plainAutocompleteStage,
        horizontalScroll: plainAutocompleteScroll,
        anchor: plainAutocompleteAnchor,
        closeAutocomplete: closePlainAutocomplete,
        updateSuggestions: refreshPlainAutocomplete,
        applySuggestion: applyPlainSuggestion,
        handleKeyDown: handlePlainAutocompleteKeyDown,
        handleCursorActivity: handlePlainAutocompleteCursorActivity,
    } = useMarkdownAutocomplete({
        value,
        allTests,
        sharedSteps,
        t,
        taRef: textareaRef,
        applyNativeEdit,
    })

    const {
        open: richAutocompleteOpen,
        items: richAutocompleteItems,
        index: richAutocompleteIndex,
        stage: richAutocompleteStage,
        horizontalScroll: richAutocompleteScroll,
        anchor: richAutocompleteAnchor,
        closeAutocomplete: closeRichAutocomplete,
        refreshAutocomplete: refreshRichAutocomplete,
        applySuggestion: applyRichSuggestion,
        handleKeyDown: handleRichAutocompleteKeyDown,
    } = useRichMarkdownAutocomplete({
        allTests,
        sharedSteps,
        t,
        editorRef: richEditorRef,
        selectionRef: richSelectionRef,
        syncEditorValue: syncRichEditorValue,
    })

    React.useEffect(() => {
        if (!preview || editInPreview) return
        textareaRef.current?.blur()
        closePlainAutocomplete()
    }, [closePlainAutocomplete, editInPreview, preview])

    React.useEffect(() => {
        if (isRichPreviewEditing) return
        closeRichAutocomplete()
    }, [closeRichAutocomplete, isRichPreviewEditing])

    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])

    React.useLayoutEffect(() => {
        syncEditorLayout()
        const frame = requestAnimationFrame(() => syncEditorLayout())
        return () => cancelAnimationFrame(frame)
    }, [isRichPreviewEditing, preview, previewHtml, syncEditorLayout, value])

    React.useLayoutEffect(() => {
        if (!isRichPreviewEditing || !richEditorRef.current) return

        const editorElement = richEditorRef.current
        const selection = document.activeElement === editorElement
            ? (readSelectionOffsets(editorElement) ?? richSelectionRef.current)
            : null

        if (previewHtml === richHtmlRef.current) return

        if (editorElement.innerHTML !== previewHtml) {
            editorElement.innerHTML = previewHtml
        }

        richHtmlRef.current = previewHtml
        restoreSelectionOffsets(editorElement, selection)
        syncEditorLayout()
    }, [isRichPreviewEditing, previewHtml, syncEditorLayout])

    React.useEffect(() => {
        if (!isRichPreviewEditing || !isActive) return

        const frame = requestAnimationFrame(() => {
            const editorElement = richEditorRef.current
            if (!editorElement) return

            editorElement.focus()
            if (!editorElement.textContent?.trim()) return

            if (!richSelectionRef.current) {
                const end = editorElement.innerText.length
                restoreSelectionOffsets(editorElement, { start: end, end })
                richSelectionRef.current = { start: end, end }
            }

            syncEditorLayout()
        })

        return () => cancelAnimationFrame(frame)
    }, [isActive, isRichPreviewEditing, syncEditorLayout, value])

    React.useEffect(() => {
        if (isRichPreviewEditing) return
        richHtmlRef.current = ''
        richSelectionRef.current = null
    }, [isRichPreviewEditing])

    React.useEffect(() => {
        if (!isRichPreviewEditing) return

        const onSelectionChange = () => {
            const editorElement = richEditorRef.current
            if (!editorElement) return
            const offsets = readSelectionOffsets(editorElement)
            if (offsets) richSelectionRef.current = offsets
        }

        document.addEventListener('selectionchange', onSelectionChange)
        return () => document.removeEventListener('selectionchange', onSelectionChange)
    }, [isRichPreviewEditing])

    React.useEffect(() => {
        const handleResize = () => syncEditorLayout()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [syncEditorLayout])

    React.useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(() => syncEditorLayout())
        const nodes = [previewMeasureRef.current, previewRef.current, richEditorRef.current].filter(Boolean)

        for (const node of nodes) {
            observer.observe(node as Element)
        }

        return () => observer.disconnect()
    }, [preview, syncEditorLayout])

    function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(event.target.value)
        refreshPlainAutocomplete(event.target, event.target.value)
    }

    function handleTextareaKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (plainAutocompleteOpen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
            return
        }
        handlePlainAutocompleteCursorActivity()
    }

    function handleTextareaPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
        if (!preview || !editInPreview || !textareaRef.current) return

        const richPayload = readClipboardRichHtmlPayload(event.clipboardData)
        if (!richPayload?.html) return

        event.preventDefault()

        const nextTextarea = textareaRef.current
        const start = Math.min(nextTextarea.selectionStart, nextTextarea.selectionEnd)
        const end = Math.max(nextTextarea.selectionStart, nextTextarea.selectionEnd)
        const nextCaret = start + richPayload.html.length
        const nextValue = applyNativeEdit(start, end, richPayload.html, nextCaret, nextCaret)

        if (typeof nextValue === 'string') {
            refreshPlainAutocomplete(nextTextarea, nextValue)
        }
    }

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${isRichPreviewEditing ? 'is-rich-preview-edit' : ''} ${className}`}>
            <MarkdownEditorToolbar
                visible={!hideToolbar && isActive}
                preview={preview}
                t={t}
                onWrap={isRichPreviewEditing ? doRichWrap : doWrap}
                onInsertPrefix={isRichPreviewEditing ? doRichInsertPrefix : doInsertPrefix}
                onTogglePreview={onTogglePreview}
            />

            <div className="md-input-wrap">
                {!isRichPreviewEditing && (
                    <>
                        <div
                            ref={previewMeasureRef}
                            className="md-preview measurer"
                            aria-hidden
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />

                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleTextareaChange}
                            onPaste={handleTextareaPaste}
                            onKeyDown={handlePlainAutocompleteKeyDown}
                            onKeyUp={handleTextareaKeyUp}
                            onClick={handlePlainAutocompleteCursorActivity}
                            onFocus={() => {
                                setIsActive(true)
                                onActivateApi?.(editorApi)
                                if (textareaRef.current) {
                                    refreshPlainAutocomplete(textareaRef.current)
                                }
                            }}
                            onBlur={() => {
                                setIsActive(false)
                                onActivateApi?.(null)
                                closePlainAutocomplete()
                            }}
                            placeholder={placeholder}
                            rows={rows}
                            className={`md-textarea ${preview && editInPreview ? 'md-textarea--preview-edit' : ''} ${preview && editInPreview && isActive ? 'md-textarea--preview-edit-active' : ''}`}
                            wrap="soft"
                            aria-hidden={preview && !editInPreview}
                            tabIndex={preview && !editInPreview ? -1 : 0}
                        />
                    </>
                )}

                {isRichPreviewEditing ? (
                    <div
                        ref={richEditorRef}
                        className="md-preview md-rich-editor"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        data-placeholder={placeholder ?? ''}
                        onFocus={() => {
                            setIsActive(true)
                            onActivateApi?.(null)
                            closePlainAutocomplete()
                            if (!richEditorRef.current) return
                            richSelectionRef.current = readSelectionOffsets(richEditorRef.current) ?? richSelectionRef.current
                            refreshRichAutocomplete()
                        }}
                        onBlur={() => {
                            setIsActive(false)
                            onActivateApi?.(null)
                            closePlainAutocomplete()
                            closeRichAutocomplete()

                            const editorElement = richEditorRef.current
                            if (!editorElement) return

                            const sanitizedHtml = sanitizeHtml(editorElement.innerHTML)
                            if (sanitizedHtml !== value) onChange(sanitizedHtml)
                            if (editorElement.innerHTML !== sanitizedHtml) editorElement.innerHTML = sanitizedHtml
                            richHtmlRef.current = sanitizedHtml
                            richSelectionRef.current = null
                        }}
                        onInput={() => {
                            syncRichEditorValue()
                            refreshRichAutocomplete()
                        }}
                        onPaste={(event) => {
                            const editorElement = richEditorRef.current
                            if (!editorElement) return

                            const richPayload = readClipboardRichHtmlPayload(event.clipboardData)
                            const plainText = event.clipboardData.getData('text/plain')
                            const htmlPayload = richPayload?.html ?? plainTextToHtml(plainText)
                            if (!htmlPayload) return

                            event.preventDefault()
                            editorElement.focus()
                            if (insertHtmlAtSelection(editorElement, htmlPayload)) {
                                syncRichEditorValue()
                            }
                        }}
                        onCopy={(event) => {
                            const editorElement = richEditorRef.current
                            if (!editorElement) return

                            const payload = cacheSelectedRichClipboard(editorElement)
                            if (!payload) return

                            event.preventDefault()
                            event.clipboardData.setData(INTERNAL_RICH_CLIPBOARD_TYPE, payload.html)
                            event.clipboardData.setData('text/html', payload.html)
                            event.clipboardData.setData('text/plain', payload.text)
                        }}
                        onCut={() => {
                            if (richEditorRef.current) {
                                cacheSelectedRichClipboard(richEditorRef.current)
                            }
                        }}
                        onMouseUp={() => {
                            if (!richEditorRef.current) return
                            richSelectionRef.current = readSelectionOffsets(richEditorRef.current)
                            refreshRichAutocomplete()
                        }}
                        onKeyUp={() => {
                            syncEditorLayout()
                            refreshRichAutocomplete()
                        }}
                        onKeyDown={handleRichAutocompleteKeyDown}
                    />
                ) : preview ? (
                    <div
                        ref={previewRef}
                        className={`md-preview ${editInPreview ? 'md-preview--editable' : ''} ${editInPreview && isActive ? 'md-preview--editing' : ''}`}
                        tabIndex={editInPreview ? -1 : 0}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                ) : null}

                {plainAutocompleteOpen && plainAutocompleteAnchor && !isRichPreviewEditing && (
                    <AutocompleteBox
                        top={plainAutocompleteAnchor.top}
                        left={plainAutocompleteAnchor.left}
                        stage={plainAutocompleteStage}
                        stageLabel={t(`markdown.stage.${plainAutocompleteStage}`)}
                        emptyLabel={t('markdown.noMatches')}
                        items={plainAutocompleteItems}
                        index={plainAutocompleteIndex}
                        horizontalScroll={plainAutocompleteScroll}
                        onPick={applyPlainSuggestion}
                        onClose={closePlainAutocomplete}
                    />
                )}

                {isRichPreviewEditing && richAutocompleteOpen && richAutocompleteAnchor ? (
                    <AutocompleteBox
                        top={richAutocompleteAnchor.top}
                        left={richAutocompleteAnchor.left}
                        stage={richAutocompleteStage}
                        stageLabel={t(`markdown.stage.${richAutocompleteStage}`)}
                        emptyLabel={t('markdown.noMatches')}
                        items={richAutocompleteItems}
                        index={richAutocompleteIndex}
                        horizontalScroll={richAutocompleteScroll}
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
