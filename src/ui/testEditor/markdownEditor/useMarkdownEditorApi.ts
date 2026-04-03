import * as React from 'react'
import type { MarkdownEditorApi } from './types'

type UseMarkdownEditorApiOptions = {
    value: string
    onChange(value: string): void
    taRef: React.MutableRefObject<HTMLTextAreaElement | null>
    apiRef?: React.MutableRefObject<MarkdownEditorApi | null>
}

export function useMarkdownEditorApi({
    value,
    onChange,
    taRef,
    apiRef,
}: UseMarkdownEditorApiOptions) {
    const valueRef = React.useRef(value)
    const onChangeRef = React.useRef(onChange)

    valueRef.current = value
    onChangeRef.current = onChange

    const dispatchTextareaInput = React.useCallback((element: HTMLTextAreaElement) => {
        const event =
            typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' })
                : new Event('input', { bubbles: true })

        element.dispatchEvent(event)
    }, [])

    const applyNativeEdit = React.useCallback((
        from: number,
        to: number,
        nextText: string,
        selectionStart?: number,
        selectionEnd?: number
    ) => {
        const element = taRef.current
        if (!element) return null

        element.focus()
        element.setSelectionRange(from, to)

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
            element.setRangeText(nextText, from, to, 'end')
            dispatchTextareaInput(element)
        }

        if (typeof selectionStart === 'number') {
            element.selectionStart = selectionStart
            element.selectionEnd = typeof selectionEnd === 'number' ? selectionEnd : selectionStart
        }

        return element.value
    }, [dispatchTextareaInput, taRef])

    const doWrap = React.useCallback((before: string, after: string) => {
        const element = taRef.current
        if (!element) return

        const start = Math.min(element.selectionStart, element.selectionEnd)
        const end = Math.max(element.selectionStart, element.selectionEnd)
        const middle = valueRef.current.slice(start, end)
        const inserted = `${before}${middle}${after}`
        const selection = start + inserted.length

        applyNativeEdit(start, end, inserted, selection, selection)
        requestAnimationFrame(() => {
            element.focus()
        })
    }, [applyNativeEdit, taRef])

    const doInsertPrefix = React.useCallback((prefix: string) => {
        const element = taRef.current
        if (!element) return

        const lines = valueRef.current.split('\n')
        const start = element.selectionStart
        const end = element.selectionEnd
        let startLine = 0
        let endLine = lines.length - 1

        for (let index = 0, offset = 0; index < lines.length; index += 1, offset += lines[index].length + 1) {
            if (offset + lines[index].length >= start) {
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

        onChangeRef.current(lines.join('\n'))
        requestAnimationFrame(() => element.focus())
    }, [taRef])

    const doInsertText = React.useCallback((text: string) => {
        const element = taRef.current
        if (!element) return

        const start = Math.min(element.selectionStart, element.selectionEnd)
        const end = Math.max(element.selectionStart, element.selectionEnd)
        const nextCaret = start + text.length

        applyNativeEdit(start, end, text, nextCaret, nextCaret)
        requestAnimationFrame(() => {
            element.focus()
            element.selectionStart = element.selectionEnd = nextCaret
        })
    }, [applyNativeEdit, taRef])

    const editorApi = React.useMemo<MarkdownEditorApi>(() => ({
        wrap: doWrap,
        insertPrefix: doInsertPrefix,
        insertText: doInsertText,
        focus: () => taRef.current?.focus(),
    }), [doInsertPrefix, doInsertText, doWrap, taRef])

    React.useEffect(() => {
        if (apiRef) apiRef.current = editorApi
        return () => {
            if (apiRef?.current === editorApi) apiRef.current = null
        }
    }, [apiRef, editorApi])

    return {
        editorApi,
        applyNativeEdit,
        doWrap,
        doInsertPrefix,
        doInsertText,
    }
}
