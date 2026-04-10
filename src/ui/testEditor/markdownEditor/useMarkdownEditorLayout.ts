import * as React from 'react'

type LayoutRefs = {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
    previewRef: React.RefObject<HTMLDivElement | null>
    previewMeasureRef: React.RefObject<HTMLDivElement | null>
    richEditorRef: React.RefObject<HTMLDivElement | null>
}

type UseMarkdownEditorLayoutArgs = LayoutRefs & {
    preview: boolean
    isRichPreviewEditing: boolean
    previewHtml: string
    value: string
    liveLayout: boolean
}

export function useMarkdownEditorLayout({
    preview,
    isRichPreviewEditing,
    previewHtml,
    value,
    liveLayout,
    textareaRef,
    previewRef,
    previewMeasureRef,
    richEditorRef,
}: UseMarkdownEditorLayoutArgs) {
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

        const textareaElement = textareaRef.current
        textareaElement.style.height = 'auto'
        if (previewRef.current) previewRef.current.style.height = 'auto'

        const textHeight = textareaElement.scrollHeight
        const previewHeight = measureElement?.scrollHeight ?? 0
        const targetHeight = preview ? Math.max(textHeight, previewHeight) : textHeight

        textareaElement.style.overflow = 'hidden'
        textareaElement.style.height = `${targetHeight}px`

        if (previewRef.current) {
            previewRef.current.style.height = `${targetHeight}px`
            previewRef.current.style.overflow = 'hidden'
        }
    }, [isRichPreviewEditing, preview, previewMeasureRef, previewRef, richEditorRef, textareaRef])

    React.useLayoutEffect(() => {
        syncEditorLayout()
        const frame = requestAnimationFrame(() => syncEditorLayout())
        return () => cancelAnimationFrame(frame)
    }, [isRichPreviewEditing, preview, previewHtml, syncEditorLayout, value])

    React.useEffect(() => {
        if (!liveLayout) return
        const handleResize = () => syncEditorLayout()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [liveLayout, syncEditorLayout])

    React.useEffect(() => {
        if (!liveLayout) return
        if (typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(() => syncEditorLayout())
        const observedNodes = [previewMeasureRef.current, previewRef.current, richEditorRef.current].filter(Boolean)

        for (const node of observedNodes) {
            observer.observe(node as Element)
        }

        return () => observer.disconnect()
    }, [liveLayout, preview, previewMeasureRef, previewRef, richEditorRef, syncEditorLayout])

    return { syncEditorLayout }
}
