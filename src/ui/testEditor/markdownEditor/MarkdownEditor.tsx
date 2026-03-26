import * as React from 'react'
import './MarkdownEditor.css'

/** Минимальный контракт теста/шага для [[wiki-refs]] автокомплита. */
export type RefTest = {
    id: string
    name: string
    steps: Array<{
        id?: string
        action?: string
        data?: string
        expected?: string
        text?: string
    }>
}

export type MarkdownEditorApi = {
    wrap(before: string, after: string): void
    insertPrefix(prefix: string): void
    focus(): void
}

export type MarkdownEditorProps = {
    value: string
    onChange(v: string): void
    placeholder?: string
    rows?: number

    /** Включить режим предварительного просмотра */
    preview?: boolean
    /** Коллбек для внешнего тоггла превью (опц.) */
    onTogglePreview?: () => void

    /** Резолвер [[wiki-refs]] перед рендером */
    resolveRefs?: (src: string) => string
    /** Данные для автокомплита [[...]] */
    allTests?: RefTest[]

    /** Выдать наружу API тулбара (опц.) */
    apiRef?: React.MutableRefObject<MarkdownEditorApi | null>

    /** Скрыть тулбар */
    hideToolbar?: boolean

    className?: string
}

type CaretAnchor = {
    top: number
    left: number
    bottom: number
}

/* ───────────────────────── Markdown ───────────────────────── */

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Простой безопасный Markdown → HTML (поддержка **,*,__,`, [link], ![img], списки) */
export function mdToHtml(src: string): string {
    const lines = src.split('\n')
    const out: string[] = []
    let inUl = false, inOl = false
    const flush = () => {
        if (inUl) { out.push('</ul>'); inUl = false }
        if (inOl) { out.push('</ol>'); inOl = false }
    }

    for (let line of lines) {
        const t = line.trim()
        if (/^-\s+/.test(t)) {
            if (!inUl) { flush(); out.push('<ul style="margin:0 0 0 20px; padding:0">'); inUl = true }
            line = t.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        if (/^\d+\.\s+/.test(t)) {
            if (!inOl) { flush(); out.push('<ol style="margin:0 0 0 20px; padding:0">'); inOl = true }
            line = t.replace(/^\d+\.\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        flush()
        if (t.length === 0) { out.push('<br/>'); continue }
        out.push(`<div>${inlineMd(line)}</div>`)
    }
    flush()
    return out.join('')
}

function inlineMd(s: string): string {
    let x = escapeHtml(s)
    x = x.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>')
    x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    x = x.replace(/__([^_]+)__/g, '<u>$1</u>')
    x = x.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    x = x.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%; vertical-align:middle;" />')
    x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    return x
}

/** Для ![[...]] — преобразуем в ![](resolved) при наличии resolveRefs */
function normalizeImageWikiRefs(src: string, resolveRefs?: (s: string) => string) {
    return src.replace(/!\[\[([^[\]]+)\]\]/g, (_m, body: string) => {
        const inside = `[[${String(body).trim()}]]`
        const resolved = resolveRefs ? resolveRefs(inside) : inside
        if (!resolved || resolved.startsWith('[[')) return _m
        return `![](${resolved})`
    })
}

/* ─────────────────────── HTML sanitizer ────────────────────── */

const ALLOW_TAGS = new Set([
    'strong','b','em','i','u','code','pre','br','p','div','span',
    'ul','ol','li','h1','h2','h3','h4','h5','h6','a','img','hr'
])
const ALLOW_ATTR: Record<string, Set<string>> = {
    a: new Set(['href','title','target','rel']),
    img: new Set(['src','alt','title']),
    span: new Set(['style']), // style только у span, дальше фильтруем
}
const URL_ATTR = new Set(['href','src'])

function isSafeUrl(url: string) {
    try {
        const u = new URL(url, 'http://x/')
        const p = u.protocol.toLowerCase()
        return p === 'http:' || p === 'https:' || url.startsWith('data:image/')
    } catch { return false }
}

/** Разрешаем только color для span: hex/rgb/rgba */
function pickSafeStyle(tag: string, style: string | null): string | null {
    if (!style || tag !== 'span') return null
    const parts = style.split(';').map(s => s.trim()).filter(Boolean)
    let colorVal: string | null = null

    for (const decl of parts) {
        const [rawProp, ...rest] = decl.split(':')
        if (!rawProp || !rest.length) continue
        const prop = rawProp.trim().toLowerCase()
        const value = rest.join(':').trim()

        if (prop === 'color') {
            const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
            const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*(0|0?\.\d+|1(\.0)?))?\s*\)$/i
            if (hex.test(value) || rgb.test(value)) colorVal = value
        }
    }
    return colorVal ? `color: ${colorVal}` : null
}

function sanitizeHtml(html: string): string {
    if (typeof html !== 'string') return ''
    const container = document.createElement('div')
    container.innerHTML = html

    const BLACKLIST_REMOVE = new Set(['script', 'style'])

    const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            const tag = el.tagName.toLowerCase()

            if (BLACKLIST_REMOVE.has(tag)) { el.remove(); return }

            if (!ALLOW_TAGS.has(tag)) {
                const parent = el.parentNode
                if (parent) {
                    while (el.firstChild) parent.insertBefore(el.firstChild, el)
                    parent.removeChild(el)
                }
            } else {
                for (const attr of Array.from(el.attributes)) {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith('on')) { el.removeAttribute(attr.name); continue }
                    if (URL_ATTR.has(name)) {
                        if (!isSafeUrl(attr.value)) { el.removeAttribute(attr.name); continue }
                    }
                    if (name === 'style') {
                        const safe = pickSafeStyle(tag, el.getAttribute('style'))
                        if (safe) el.setAttribute('style', safe)
                        else el.removeAttribute('style')
                        continue
                    }
                    const allowForTag = ALLOW_ATTR[tag]
                    if (allowForTag) {
                        if (!allowForTag.has(name)) el.removeAttribute(attr.name)
                    } else {
                        if (name !== 'title') el.removeAttribute(attr.name)
                    }
                }
            }
        }
        for (const child of Array.from(node.childNodes)) walk(child)
    }

    walk(container)

    for (const a of Array.from(container.querySelectorAll('a'))) {
        a.setAttribute('rel', 'noopener noreferrer')
        if (!a.getAttribute('target')) a.setAttribute('target', '_blank')
    }

    return container.innerHTML
}

function looksLikeHtml(s: string) {
    return /<\s*(strong|b|em|i|u|code|pre|br|p|div|span|ol|ul|li|h[1-6]|a|img)\b/i.test(s)
}

function getCaretAnchor(el: HTMLTextAreaElement): CaretAnchor | null {
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
    mirror.style.textAlign = styles.textAlign as string
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
    const top = markerRect.top + window.scrollY - el.scrollTop
    const left = markerRect.left + window.scrollX - el.scrollLeft

    return { top, left, bottom: top + height }
}

/* ───────────────────────── Компонент ───────────────────────── */

export function MarkdownEditor(props: MarkdownEditorProps) {
    const {
        value,
        onChange,
        placeholder,
        rows = 3,
        preview = false,
        onTogglePreview,
        resolveRefs,
        allTests = [],
        apiRef,
        hideToolbar = false,
        className = '',
    } = props

    const taRef = React.useRef<HTMLTextAreaElement | null>(null)
    const previewRef = React.useRef<HTMLDivElement | null>(null)
    const measurerRef = React.useRef<HTMLDivElement | null>(null) // ← скрытый измеритель
    const [active, setActive] = React.useState(false)

    // тулбар API
    const doWrap = React.useCallback((before: string, after: string) => {
        const el = taRef.current
        if (!el) return
        const start = Math.min(el.selectionStart, el.selectionEnd)
        const end = Math.max(el.selectionStart, el.selectionEnd)
        const left = value.slice(0, start)
        const mid  = value.slice(start, end)
        const right= value.slice(end)
        onChange(left + before + mid + after + right)
        requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = start + before.length + mid.length + after.length
            el.focus()
        })
    }, [value, onChange])

    const doInsertPrefix = React.useCallback((prefix: string) => {
        const el = taRef.current
        if (!el) return
        const lines = value.split('\n')
        const s = el.selectionStart, e = el.selectionEnd
        let sLine = 0, eLine = lines.length - 1
        for (let i=0, acc=0; i<lines.length; i++, acc += lines[i].length + 1) {
            if (acc + lines[i].length >= s) { sLine = i; break }
        }
        for (let i=sLine; i<lines.length; i++) {
            const lineStart = lines.slice(0, i).join('\n').length + (i ? 1 : 0)
            const lineEnd = lineStart + lines[i].length
            if (lineEnd >= e) { eLine = i; break }
        }
        for (let j=sLine; j<=eLine; j++) {
            lines[j] = lines[j].length ? `${prefix} ${lines[j]}` : `${prefix} `
        }
        onChange(lines.join('\n'))
        requestAnimationFrame(() => el.focus())
    }, [value, onChange])

    React.useEffect(() => {
        if (!apiRef) return
        apiRef.current = {
            wrap: doWrap,
            insertPrefix: doInsertPrefix,
            focus: () => taRef.current?.focus(),
        }
        return () => { if (apiRef) apiRef.current = null }
    }, [apiRef, doWrap, doInsertPrefix])

    // HTML для превью/измерителя
    const renderPreviewHtml = React.useCallback((input: string) => {
        const src = typeof resolveRefs === 'function' ? resolveRefs(input ?? '') : (input ?? '')
        if (looksLikeHtml(src)) {
            return sanitizeHtml(src)
        } else {
            return mdToHtml(normalizeImageWikiRefs(src, resolveRefs))
        }
    }, [resolveRefs])

    // Синхронизация высот: textarea и preview получают одинаковую высоту = высоте измерителя
    const syncHeights = React.useCallback(() => {
        const ta = taRef.current
        if (!ta) return

        // 1) обновляем содержимое измерителя и меряем его
        const measurer = measurerRef.current
        if (measurer) {
            // уже содержит HTML через dangerouslySetInnerHTML в JSX; просто меряем
            // форсируем reflow
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            measurer.offsetHeight
        }

        const targetH =
            measurer?.scrollHeight ??
            (previewRef.current?.scrollHeight || ta.scrollHeight)

        // 2) выставляем одинаковую высоту всем поверхностям
        ta.style.height = 'auto'
        ta.style.overflow = 'hidden'
        ta.style.height = `${targetH}px`

        if (previewRef.current) {
            previewRef.current.style.height = `${targetH}px`
            previewRef.current.style.overflow = 'auto'
        }
    }, [])

    // триггеры синхронизации
    React.useLayoutEffect(() => { syncHeights() }, [value, preview, syncHeights])

    React.useEffect(() => {
        const onResize = () => syncHeights()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [syncHeights])

    React.useEffect(() => {
        if (!preview) return
        taRef.current?.blur()
        setAcOpen(false)
    }, [preview])

    // ───── автокомплит [[...]]
    const [acOpen, setAcOpen] = React.useState(false)
    const [acItems, setAcItems] = React.useState<Array<{ label: string; insert: string }>>([])
    const [acIndex, setAcIndex] = React.useState(0)
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [range, setRange] = React.useState<{ from: number; to: number } | null>(null)

    function updateSuggestions(el: HTMLTextAreaElement) {
        const caret = el.selectionStart
        const before = value.slice(0, caret)
        const start = before.lastIndexOf('[[')
        const close = before.lastIndexOf(']]')
        if (start === -1 || (close !== -1 && close > start)) {
            setAcOpen(false); setRange(null); return
        }
        const q = before.slice(start + 2)
        const caretAnchor = getCaretAnchor(el)
        const menuWidth = 380
        const menuHeight = 260
        const gutter = 12
        const fallbackRect = el.getBoundingClientRect()
        const minLeft = window.scrollX + gutter
        const maxLeft = Math.max(minLeft, window.scrollX + window.innerWidth - menuWidth - gutter)
        const left = caretAnchor
            ? Math.max(minLeft, Math.min(caretAnchor.left, maxLeft))
            : fallbackRect.left + window.scrollX + 8
        const top = caretAnchor
            ? (
                caretAnchor.bottom + menuHeight + gutter <= window.scrollY + window.innerHeight
                    ? caretAnchor.bottom + 6
                    : Math.max(window.scrollY + gutter, caretAnchor.top - menuHeight - 6)
            )
            : fallbackRect.bottom + window.scrollY
        setAnchor({ top, left })
        setRange({ from: start, to: caret })

        const hashPos = q.indexOf('#')
        if (hashPos === -1) {
            const qTest = q.trim().toLowerCase()
            const tests = (props.allTests ?? [])
                .filter((t) => t.name.toLowerCase().includes(qTest))
                .slice(0, 20)
                .map((t) => ({ label: `📄 ${t.name}`, insert: `${t.name}` }))
            setAcItems(tests); setAcIndex(0); setAcOpen(tests.length > 0); return
        } else {
            const testName = q.slice(0, hashPos).trim()
            const stepFilter = q.slice(hashPos + 1).trim().toLowerCase()
            const test = (props.allTests ?? []).find((t) => t.name.toLowerCase().startsWith(testName.toLowerCase()))
            if (!test) { setAcOpen(false); return }
            const items: Array<{ label: string; insert: string }> = []
            test.steps.forEach((s, i) => {
                const idx = i + 1
                const head = (s.action || s.text || '') as string
                const data = (s.data || '') as string
                const exp  = (s.expected || '') as string
                const variants = [
                    { suffix: '', txt: head },
                    { suffix: '.data', txt: data },
                    { suffix: '.expected', txt: exp },
                ]
                for (const v of variants) {
                    const label = `#${idx}${v.suffix} — ${trimText(head || data || exp)}`
                    const ins = `${test.name}#${idx}${v.suffix}`
                    const hay = (String(idx) + ' ' + v.suffix + ' ' + head + ' ' + data + ' ' + exp).toLowerCase()
                    if (hay.includes(stepFilter)) items.push({ label, insert: ins })
                }
            })
            const limited = items.slice(0, 50)
            setAcItems(limited); setAcIndex(0); setAcOpen(limited.length > 0); return
        }
    }

    function trimText(s: string, n = 60) {
        const t = String(s ?? '').replace(/\s+/g, ' ').trim()
        return t.length > n ? t.slice(0, n - 1) + '…' : t
    }

    function applySuggestion(item: { label: string; insert: string }) {
        const el = taRef.current
        if (!el || !range) return
        const left = value.slice(0, range.from)
        const right = value.slice(range.to)
        const newVal = `${left}[[${item.insert}]]${right}`
        onChange(newVal)
        const pos = (left + '[[' + item.insert + ']]').length
        requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = pos })
        setAcOpen(false)
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!acOpen) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acItems.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const it = acItems[acIndex]; if (it) applySuggestion(it) }
        else if (e.key === 'Escape') { e.preventDefault(); setAcOpen(false) }
    }

    function onChangeWrapped(e: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(e.target.value)
        updateSuggestions(e.target)
        // высота синхронизируется через useLayoutEffect
    }
    function onClickOrKeyUp() {
        const el = taRef.current
        if (!el) return
        updateSuggestions(el)
    }

    // тулбар
    const toolbar = !hideToolbar && active && !preview ? (
        <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
            <button type="button" className="md-btn" title="Bold" onClick={() => doWrap('**', '**')}>B</button>
            <button type="button" className="md-btn" title="Italic" onClick={() => doWrap('*', '*')}><i>I</i></button>
            <button type="button" className="md-btn" title="Underline" onClick={() => doWrap('__', '__')}><u>U</u></button>
            <div className="divider" />
            <button className="md-btn" title="Bulleted list" onClick={() => doInsertPrefix('-')}>•</button>
            <button className="md-btn" title="Numbered list" onClick={() => doInsertPrefix('1.')}>1.</button>
            <div className="divider" />
            <button className="md-btn" title="Code" onClick={() => doWrap('`', '`')}>{'</>'}</button>
            <button className="md-btn" title="Link" onClick={() => doWrap('[', '](url)')}>🔗</button>
            <button className="md-btn" title="Image" onClick={() => doWrap('![', '](image.png)')}>🖼️</button>
            {typeof onTogglePreview === 'function' && (
                <>
                    <div className="divider" />
                    <button className="md-btn" title="Toggle preview" onClick={onTogglePreview}>Preview</button>
                </>
            )}
        </div>
    ) : null

    const html = React.useMemo(() => renderPreviewHtml(value), [value]) // один раз считаем HTML

    const previewHtml = React.useMemo(() => renderPreviewHtml(value), [value, renderPreviewHtml])

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${className || ''}`}>
            {toolbar}
            <div className="md-input-wrap">
                {/* скрытый измеритель — ВСЕГДА присутствует и принимает итоговый HTML */}
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
                    onKeyDown={onKeyDown}
                    onKeyUp={onClickOrKeyUp}
                    onClick={onClickOrKeyUp}
                    onFocus={() => {
                        setActive(true)
                        const el = taRef.current
                        if (el) updateSuggestions(el)
                    }}
                    onBlur={() => { setActive(false); setAcOpen(false) }}
                    placeholder={placeholder}
                    rows={rows}
                    className="md-textarea"
                    wrap="soft"
                    aria-hidden={preview}
                    tabIndex={preview ? -1 : 0}
                />

                {preview && (
                    <div
                        ref={previewRef}
                        className="md-preview"
                        tabIndex={0}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                )}

                {acOpen && anchor && (
                    <AutocompleteBox
                        top={anchor.top}
                        left={anchor.left}
                        items={acItems}
                        index={acIndex}
                        onPick={applySuggestion}
                        onClose={() => setAcOpen(false)}
                    />
                )}
            </div>
        </div>
    )
}

/* ────────────────────────── Autocomplete ───────────────────────── */

type AutoItem = { label: string; insert: string }
type AutocompleteBoxProps = {
    top: number
    left: number
    items: AutoItem[]
    index: number
    onPick(item: AutoItem): void
    onClose(): void
}

const AutocompleteBox: React.FC<AutocompleteBoxProps> = ({
                                                             top, left, items, index, onPick, onClose,
                                                         }) => {
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    React.useEffect(() => {
        const onScroll = () => onClose()
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [onClose])

    return (
        <div className="autocomplete" style={{ top, left }} role="listbox" aria-label="Wiki references suggestions">
            {items.length === 0 ? (
                <div className="autocomplete-empty">No matches</div>
            ) : (
                items.map((it, i) => (
                    <div
                        key={`${it.insert}-${i}`}
                        onMouseDown={(e) => { e.preventDefault(); onPick(it) }}
                        className={`autocomplete-item ${i === index ? 'active' : ''}`}
                        role="option"
                        aria-selected={i === index}
                        title={it.insert}
                    >
                        {it.label}
                    </div>
                ))
            )}
        </div>
    )
}

export default MarkdownEditor
