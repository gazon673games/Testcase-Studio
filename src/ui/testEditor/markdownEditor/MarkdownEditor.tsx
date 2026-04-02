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

    const {
        editorApi,
        applyNativeEdit,
        doWrap,
        doInsertPrefix,
    } = useMarkdownEditorApi({
        value,
        onChange,
        active,
        taRef,
        apiRef,
        onActivateApi,
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
        if (!preview) return
        taRef.current?.blur()
        closeAutocomplete()
    }, [closeAutocomplete, preview])

    function onChangeWrapped(event: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(event.target.value)
        updateSuggestions(event.target, event.target.value)
    }

    function onKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (acOpen && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].includes(event.key)) return
        handleCursorActivity()
    }

    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])
    const previewHtml = React.useMemo(() => renderPreviewHtml(value), [renderPreviewHtml, value])

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${className}`}>
            <MarkdownEditorToolbar
                visible={!hideToolbar && active}
                preview={preview}
                t={t}
                onWrap={doWrap}
                onInsertPrefix={doInsertPrefix}
                onTogglePreview={onTogglePreview}
            />
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
                        onClose={closeAutocomplete}
                    />
                )}
            </div>

            <MarkdownRefStrip refs={refs} t={t} onOpenRef={onOpenRef} />
        </div>
    )
}

export default MarkdownEditor
