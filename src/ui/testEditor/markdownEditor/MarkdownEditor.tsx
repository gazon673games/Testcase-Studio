import * as React from 'react'
import { AutocompleteBox } from './AutocompleteBox'
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar'
import { MarkdownRefStrip } from './MarkdownRefStrip'
import { readClipboardRichHtmlPayload } from './richClipboard'
import { readSelectionOffsets, restoreSelectionOffsets, type RichTextSelectionOffsets } from './richTextDom'
import type { MarkdownEditorProps } from './types'
import { useMarkdownEditorLayout } from './useMarkdownEditorLayout'
import { useMarkdownAutocomplete } from './useMarkdownAutocomplete'
import { useMarkdownEditorApi } from './useMarkdownEditorApi'
import { useRichPreviewEditing } from './useRichPreviewEditing'
import { useRichMarkdownAutocomplete } from './useRichMarkdownAutocomplete'
import { looksLikeHtml, renderPreviewContent, sanitizeHtml } from './previewRendering'
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
    const { syncEditorLayout } = useMarkdownEditorLayout({
        preview,
        isRichPreviewEditing,
        previewHtml,
        value,
        textareaRef,
        previewRef,
        previewMeasureRef,
        richEditorRef,
    })

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

    const {
        wrapRichSelection,
        insertRichPrefix,
        richEditorHandlers,
    } = useRichPreviewEditing({
        value,
        previewHtml,
        isRichPreviewEditing,
        isActive,
        syncRichEditorValue,
        onChange,
        onActivateApi,
        setIsActive,
        syncEditorLayout,
        closePlainAutocomplete,
        closeRichAutocomplete,
        refreshRichAutocomplete,
        richEditorRef,
        richHtmlRef,
        richSelectionRef,
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
                onWrap={isRichPreviewEditing ? wrapRichSelection : doWrap}
                onInsertPrefix={isRichPreviewEditing ? insertRichPrefix : doInsertPrefix}
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
                        onFocus={richEditorHandlers.onFocus}
                        onBlur={richEditorHandlers.onBlur}
                        onInput={richEditorHandlers.onInput}
                        onPaste={richEditorHandlers.onPaste}
                        onCopy={richEditorHandlers.onCopy}
                        onCut={richEditorHandlers.onCut}
                        onMouseUp={richEditorHandlers.onMouseUp}
                        onKeyUp={richEditorHandlers.onKeyUp}
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
