export type CaretAnchor = { top: number; left: number; bottom: number }

export function getCaretAnchor(el: HTMLTextAreaElement): CaretAnchor | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null

    const rect = el.getBoundingClientRect()
    const styles = window.getComputedStyle(el)
    const mirror = document.createElement('div')
    const marker = document.createElement('span')
    const caret = el.selectionStart ?? 0

    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.pointerEvents = 'none'
    mirror.style.boxSizing = styles.boxSizing
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordBreak = 'break-word'
    mirror.style.overflowWrap = 'anywhere'
    mirror.style.width = `${rect.width}px`
    mirror.style.left = `${rect.left + window.scrollX}px`
    mirror.style.top = `${rect.top + window.scrollY}px`
    mirror.style.padding = styles.padding
    mirror.style.border = styles.border
    mirror.style.font = styles.font
    mirror.style.fontFamily = styles.fontFamily
    mirror.style.fontSize = styles.fontSize
    mirror.style.fontStyle = styles.fontStyle
    mirror.style.fontWeight = styles.fontWeight
    mirror.style.letterSpacing = styles.letterSpacing
    mirror.style.lineHeight = styles.lineHeight
    mirror.style.textAlign = styles.textAlign
    mirror.style.textTransform = styles.textTransform
    mirror.style.textIndent = styles.textIndent
    mirror.style.tabSize = styles.tabSize

    mirror.textContent = el.value.slice(0, caret)
    marker.textContent = el.value.slice(caret, caret + 1) || '\u200b'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const markerRect = marker.getBoundingClientRect()
    document.body.removeChild(mirror)

    const height = markerRect.height || parseFloat(styles.lineHeight) || 18
    const top = markerRect.top - el.scrollTop
    const left = markerRect.left - el.scrollLeft
    return { top, left, bottom: top + height }
}
