function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMd(src: string): string {
    let html = escapeHtml(src)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<u>$1</u>')
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    return html
}

export function mdToHtml(src: string): string {
    const lines = String(src ?? '').split('\n')
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
                out.push('<ul>')
                inUl = true
            }
            line = trimmed.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOl) {
                flush()
                out.push('<ol>')
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

export function looksLikeHtml(src: string): boolean {
    return /<\s*(strong|b|em|i|u|code|pre|br|p|div|span|ol|ul|li|h[1-6]|a|img)\b/i.test(String(src ?? ''))
}
