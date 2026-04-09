import { sanitizeHtml } from './previewRendering'
import { htmlToPlainText } from './richTextDom'

export const INTERNAL_RICH_CLIPBOARD_TYPE = 'application/x-testcase-studio-rich-html'

type RichClipboardPayload = {
    html: string
    text: string
}

let lastRichClipboard: (RichClipboardPayload & { capturedAt: number }) | null = null

function readSelectedClipboardPayload(root: HTMLElement): RichClipboardPayload | null {
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

function readFallbackClipboard(text: string) {
    if (!lastRichClipboard) return null
    if (Date.now() - lastRichClipboard.capturedAt > 60_000) return null
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
    if (normalize(text) !== normalize(lastRichClipboard.text)) return null
    return lastRichClipboard
}

export function cacheSelectedRichClipboard(root: HTMLElement) {
    const payload = readSelectedClipboardPayload(root)
    if (!payload) return null

    lastRichClipboard = {
        ...payload,
        capturedAt: Date.now(),
    }

    return payload
}

export function readClipboardRichHtmlPayload(clipboardData: DataTransfer | null) {
    if (!clipboardData) return null

    const internalHtml = clipboardData.getData(INTERNAL_RICH_CLIPBOARD_TYPE)
    const html = clipboardData.getData('text/html')
    const text = clipboardData.getData('text/plain')
    const fallback = !internalHtml && !html ? readFallbackClipboard(text) : null

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
