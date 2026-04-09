import * as React from 'react'
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
import { escapeHtml, sanitizeHtml } from './previewRendering'

type UseRichPreviewEditingArgs = {
    value: string
    previewHtml: string
    isRichPreviewEditing: boolean
    isActive: boolean
    syncRichEditorValue: () => void
    onChange: (value: string) => void
    onActivateApi?: (api: null) => void
    setIsActive: (active: boolean) => void
    syncEditorLayout: () => void
    closePlainAutocomplete: () => void
    closeRichAutocomplete: () => void
    refreshRichAutocomplete: () => void
    richEditorRef: React.RefObject<HTMLDivElement | null>
    richHtmlRef: React.MutableRefObject<string>
    richSelectionRef: React.MutableRefObject<RichTextSelectionOffsets | null>
}

export function useRichPreviewEditing({
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
}: UseRichPreviewEditingArgs) {
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
    }, [richEditorRef, syncRichEditorValue])

    const wrapRichSelection = React.useCallback((before: string, after: string) => {
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
    }, [execRichCommand, richEditorRef, syncRichEditorValue])

    const insertRichPrefix = React.useCallback((prefix: string) => {
        if (prefix === '-') {
            execRichCommand('insertUnorderedList')
            return
        }
        if (prefix === '1.') {
            execRichCommand('insertOrderedList')
        }
    }, [execRichCommand])

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
    }, [isRichPreviewEditing, previewHtml, richEditorRef, richHtmlRef, richSelectionRef, syncEditorLayout])

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
    }, [isActive, isRichPreviewEditing, richEditorRef, richSelectionRef, syncEditorLayout, value])

    React.useEffect(() => {
        if (isRichPreviewEditing) return
        richHtmlRef.current = ''
        richSelectionRef.current = null
    }, [isRichPreviewEditing, richHtmlRef, richSelectionRef])

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
    }, [isRichPreviewEditing, richEditorRef, richSelectionRef])

    const richEditorHandlers = React.useMemo(() => ({
        onFocus: () => {
            setIsActive(true)
            onActivateApi?.(null)
            closePlainAutocomplete()
            if (!richEditorRef.current) return
            richSelectionRef.current = readSelectionOffsets(richEditorRef.current) ?? richSelectionRef.current
            refreshRichAutocomplete()
        },
        onBlur: () => {
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
        },
        onInput: () => {
            syncRichEditorValue()
            refreshRichAutocomplete()
        },
        onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => {
            const editorElement = richEditorRef.current
            if (!editorElement) return

            const richPayload = readClipboardRichHtmlPayload(event.clipboardData)
            const internalHtml = event.clipboardData.getData(INTERNAL_RICH_CLIPBOARD_TYPE)
            const plainText = event.clipboardData.getData('text/plain')
            const htmlPayload = internalHtml || richPayload?.html || plainTextToHtml(plainText)
            if (!htmlPayload) return

            event.preventDefault()
            editorElement.focus()
            if (insertHtmlAtSelection(editorElement, htmlPayload)) {
                syncRichEditorValue()
            }
        },
        onCopy: (event: React.ClipboardEvent<HTMLDivElement>) => {
            const editorElement = richEditorRef.current
            if (!editorElement) return

            const payload = cacheSelectedRichClipboard(editorElement)
            if (!payload) return

            event.preventDefault()
            event.clipboardData.setData(INTERNAL_RICH_CLIPBOARD_TYPE, payload.html)
            event.clipboardData.setData('text/html', payload.html)
            event.clipboardData.setData('text/plain', payload.text)
        },
        onCut: () => {
            if (richEditorRef.current) {
                cacheSelectedRichClipboard(richEditorRef.current)
            }
        },
        onMouseUp: () => {
            if (!richEditorRef.current) return
            richSelectionRef.current = readSelectionOffsets(richEditorRef.current)
            refreshRichAutocomplete()
        },
        onKeyUp: () => {
            syncEditorLayout()
            refreshRichAutocomplete()
        },
    }), [
        closePlainAutocomplete,
        closeRichAutocomplete,
        onActivateApi,
        onChange,
        refreshRichAutocomplete,
        richEditorRef,
        richHtmlRef,
        richSelectionRef,
        setIsActive,
        syncEditorLayout,
        syncRichEditorValue,
        value,
    ])

    return {
        syncRichEditorValue,
        wrapRichSelection,
        insertRichPrefix,
        richEditorHandlers,
    }
}
