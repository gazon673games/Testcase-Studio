export function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMd(src: string): string {
    let html = escapeHtml(src)
    html = html.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>')
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<u>$1</u>')
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%; vertical-align:middle;" />')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    return html
}

export function mdToHtml(src: string): string {
    const lines = src.split('\n')
    const out: string[] = []
    let inUl = false
    let inOl = false

    const flush = () => {
        if (inUl) {
            out.push('</ul>')
            inUl = false
        }
        if (inOl) {
            out.push('</ol>')
            inOl = false
        }
    }

    for (let line of lines) {
        const trimmed = line.trim()
        if (/^-\s+/.test(trimmed)) {
            if (!inUl) {
                flush()
                out.push('<ul style="margin:0 0 0 20px; padding:0">')
                inUl = true
            }
            line = trimmed.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOl) {
                flush()
                out.push('<ol style="margin:0 0 0 20px; padding:0">')
                inOl = true
            }
            line = trimmed.replace(/^\d+\.\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        flush()
        if (!trimmed.length) {
            out.push('<br/>')
            continue
        }
        out.push(`<div>${inlineMd(line)}</div>`)
    }

    flush()
    return out.join('')
}

export function normalizeImageWikiRefs(src: string, resolveRefs?: (s: string) => string) {
    return src.replace(/!\[\[([^[\]]+)\]\]/g, (match, body: string) => {
        const inside = `[[${String(body).trim()}]]`
        const resolved = resolveRefs ? resolveRefs(inside) : inside
        if (!resolved || resolved.startsWith('[[')) return match
        return `![](${resolved})`
    })
}

export function renderPreviewContent(source: string, resolveRefs?: (source: string) => string) {
    const resolved = typeof resolveRefs === 'function' ? resolveRefs(source ?? '') : (source ?? '')
    return looksLikeHtml(resolved)
        ? sanitizeHtml(resolved)
        : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))
}

const ALLOW_TAGS = new Set([
    'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'br', 'p', 'div', 'span',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'hr',
])

const ALLOW_ATTR: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    img: new Set(['src', 'alt', 'title']),
    span: new Set(['style']),
}

const URL_ATTR = new Set(['href', 'src'])

function isSafeUrl(value: string) {
    try {
        const parsed = new URL(value, 'http://x/')
        const protocol = parsed.protocol.toLowerCase()
        const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp|avif|ico);base64,/i
        return protocol === 'http:' || protocol === 'https:' || SAFE_DATA_IMAGE.test(value)
    } catch {
        return false
    }
}

function pickSafeStyle(tag: string, style: string | null): string | null {
    if (!style || tag !== 'span') return null
    const declarations = style.split(';').map((item) => item.trim()).filter(Boolean)
    let colorValue: string | null = null
    let fontWeightValue: string | null = null
    let fontStyleValue: string | null = null
    let textDecorationValue: string | null = null

    for (const declaration of declarations) {
        const [rawProp, ...rest] = declaration.split(':')
        if (!rawProp || !rest.length) continue
        const prop = rawProp.trim().toLowerCase()
        const value = rest.join(':').trim()

        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
        const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*(0|0?\.\d+|1(\.0)?))?\s*\)$/i
        if (prop === 'color') {
            if (hex.test(value) || rgb.test(value)) colorValue = value
            continue
        }

        if (prop === 'font-weight') {
            const normalized = value.toLowerCase()
            if (normalized === 'bold' || normalized === 'bolder') fontWeightValue = 'bold'
            else if (/^[5-9]00$/.test(normalized)) fontWeightValue = normalized
            continue
        }

        if (prop === 'font-style') {
            const normalized = value.toLowerCase()
            if (normalized === 'italic') fontStyleValue = 'italic'
            continue
        }

        if (prop === 'text-decoration' || prop === 'text-decoration-line') {
            const normalized = value.toLowerCase()
            if (normalized.includes('underline')) textDecorationValue = 'underline'
            continue
        }
    }

    const safeDeclarations = [
        colorValue ? `color: ${colorValue}` : null,
        fontWeightValue ? `font-weight: ${fontWeightValue}` : null,
        fontStyleValue ? `font-style: ${fontStyleValue}` : null,
        textDecorationValue ? `text-decoration: ${textDecorationValue}` : null,
    ].filter(Boolean)

    return safeDeclarations.length ? safeDeclarations.join('; ') : null
}

export function sanitizeHtml(html: string): string {
    if (typeof html !== 'string') return ''
    const container = document.createElement('div')
    container.innerHTML = html

    const blacklist = new Set(['script', 'style'])
    const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            const tag = element.tagName.toLowerCase()
            if (blacklist.has(tag)) {
                element.remove()
                return
            }

            if (!ALLOW_TAGS.has(tag)) {
                const parent = element.parentNode
                if (parent) {
                    while (element.firstChild) parent.insertBefore(element.firstChild, element)
                    parent.removeChild(element)
                }
            } else {
                for (const attr of Array.from(element.attributes)) {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith('on')) {
                        element.removeAttribute(attr.name)
                        continue
                    }
                    if (URL_ATTR.has(name) && !isSafeUrl(attr.value)) {
                        element.removeAttribute(attr.name)
                        continue
                    }
                    if (name === 'style') {
                        const safeStyle = pickSafeStyle(tag, element.getAttribute('style'))
                        if (safeStyle) element.setAttribute('style', safeStyle)
                        else element.removeAttribute('style')
                        continue
                    }
                    const allowForTag = ALLOW_ATTR[tag]
                    if (allowForTag) {
                        if (!allowForTag.has(name)) element.removeAttribute(attr.name)
                    } else if (name !== 'title') {
                        element.removeAttribute(attr.name)
                    }
                }
            }
        }

        for (const child of Array.from(node.childNodes)) walk(child)
    }

    walk(container)
    for (const link of Array.from(container.querySelectorAll('a'))) {
        link.setAttribute('rel', 'noopener noreferrer')
        if (!link.getAttribute('target')) link.setAttribute('target', '_blank')
    }

    return container.innerHTML
}

export function looksLikeHtml(src: string) {
    return /<\s*(strong|b|em|i|u|code|pre|br|p|div|span|ol|ul|li|h[1-6]|a|img)\b/i.test(src)
}
