import { looksLikeHtml, mdToHtml, normalizeImageWikiRefs, sanitizeHtml } from '../../markdownEditor/previewRendering'

export function renderInsertStepsPreviewHtml(input: string, resolveRefs: (src: string) => string) {
    const resolved = resolveRefs(input ?? '')
    const html = looksLikeHtml(resolved)
        ? sanitizeHtml(resolved)
        : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))

    return normalizeModalPreviewHtml(html)
}

function normalizeModalPreviewHtml(html: string) {
    if (typeof document === 'undefined') return html

    const container = document.createElement('div')
    container.innerHTML = html
    removeZephyrSpacerWrappers(container)
    trimTextNodeEdges(container)
    trimContainerEdges(container)
    return container.innerHTML
}

function trimContainerEdges(container: HTMLElement) {
    let changed = true

    while (changed) {
        changed = false

        const first = container.firstChild
        if (first && isIgnorableEdgeNode(first, 'start')) {
            container.removeChild(first)
            changed = true
            continue
        }

        const last = container.lastChild
        if (last && isIgnorableEdgeNode(last, 'end')) {
            container.removeChild(last)
            changed = true
        }
    }
}

function isIgnorableEdgeNode(node: ChildNode, edge: 'start' | 'end'): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
        return !String(node.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false

    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (tag === 'br') return true

    trimContainerEdges(element)

    if (isEmptyEdgeElement(element)) return true

    if ((tag === 'div' || tag === 'p') && edge === 'start') {
        const first = element.firstChild
        return first != null && isIgnorableEdgeNode(first as ChildNode, edge) && !String(element.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    if ((tag === 'div' || tag === 'p') && edge === 'end') {
        const last = element.lastChild
        return last != null && isIgnorableEdgeNode(last as ChildNode, edge) && !String(element.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    return false
}

function isEmptyEdgeElement(element: HTMLElement) {
    if (element.querySelector('img, video, audio, iframe, table')) return false

    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('br').forEach((item) => item.remove())
    return !String(clone.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function removeZephyrSpacerWrappers(container: HTMLElement) {
    for (const element of Array.from(container.querySelectorAll('em, span, div, p'))) {
        if (!isEmptyElementWithOnlyBreaks(element as HTMLElement)) continue
        element.remove()
    }
}

function isEmptyElementWithOnlyBreaks(element: HTMLElement) {
    if (element.querySelector('img, video, audio, iframe, table, ol, ul, li, pre')) return false
    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('br').forEach((item) => item.remove())
    return !String(clone.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function trimTextNodeEdges(container: HTMLElement) {
    for (const node of Array.from(container.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const normalized = String(node.textContent ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/^[ \t\r\n]+/, '')
                .replace(/[ \t\r\n]+$/, '')
            node.textContent = normalized
            continue
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            trimTextNodeEdges(node as HTMLElement)
        }
    }
}
