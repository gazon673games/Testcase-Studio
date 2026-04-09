import { escapeHtml } from './previewRendering'

export type RichTextSelectionOffsets = {
    start: number
    end: number
}

type ContentEditableCaretState = {
    caret: number
    anchor: {
        top: number
        left: number
        bottom: number
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

export function readSelectionOffsets(root: HTMLElement): RichTextSelectionOffsets | null {
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

export function restoreSelectionOffsets(root: HTMLElement, offsets: RichTextSelectionOffsets | null) {
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

export function plainTextToHtml(value: string) {
    return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

export function htmlToPlainText(html: string) {
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

export function insertHtmlAtSelection(root: HTMLElement, html: string) {
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

export function readContentEditableCaret(root: HTMLElement): ContentEditableCaretState | null {
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

export function readContentEditablePlainText(root: HTMLElement) {
    return root.innerText.replace(/\r\n/g, '\n')
}

export function replaceContentEditableTextRange(root: HTMLElement, from: number, to: number, text: string) {
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
