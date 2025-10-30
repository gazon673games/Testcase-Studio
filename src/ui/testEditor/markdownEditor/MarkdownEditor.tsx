import * as React from 'react'
import './MarkdownEditor.css'

/**
 * Минимальный контракт теста/шага для [[wiki-refs]] автокомплита.
 */
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

/** Разрешённые теги и атрибуты */
const ALLOW_TAGS = new Set([
    'strong','b','em','i','u','code','pre','br','p','div','span',
    'ul','ol','li','h1','h2','h3','h4','h5','h6','a','img','hr'
])
const ALLOW_ATTR: Record<string, Set<string>> = {
    'a': new Set(['href','title','target','rel']),
    'img': new Set(['src','alt','title']),
    // прочим тегам атрибуты режем
}
const URL_ATTR = new Set(['href','src'])

function isSafeUrl(url: string) {
    try {
        const u = new URL(url, 'http://x/') // base чтобы относительные не падали
        const p = u.protocol.toLowerCase()
        return p === 'http:' || p === 'https:' || (url.startsWith('data:image/'))
    } catch { return false }
}

/** Санитизируем HTML через DOMParser (в рантайме браузера/электрона) */
function sanitizeHtml(html: string): string {
    // 1) защитимся от нестрок
    if (typeof html !== 'string') return ''

    // 2) создаём контейнер и вливаем html
    const container = document.createElement('div')
    container.innerHTML = html

    // 3) рекурсивная чистка по allowlist
    const BLACKLIST_REMOVE = new Set(['script', 'style']) // эти вырезаем целиком

    const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement
            const tag = el.tagName.toLowerCase()

            if (BLACKLIST_REMOVE.has(tag)) {
                // удаляем узел со всем содержимым
                el.remove()
                return
            }

            if (!ALLOW_TAGS.has(tag)) {
                // unwrap: переносим детей наверх, сам узел убираем
                const parent = el.parentNode
                if (parent) {
                    while (el.firstChild) parent.insertBefore(el.firstChild, el)
                    parent.removeChild(el)
                    // после unwrap нужно не продолжать обход текущего el (он уже удалён),
                    // но его дети уже перемещены наверх — они попадут в обход родителя.
                }
            } else {
                // чистим атрибуты
                for (const attr of Array.from(el.attributes)) {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith('on') || name === 'style') { el.removeAttribute(attr.name); continue }
                    if (URL_ATTR.has(name)) {
                        if (!isSafeUrl(attr.value)) { el.removeAttribute(attr.name); continue }
                    }
                    const allowForTag = ALLOW_ATTR[tag]
                    if (allowForTag) {
                        if (!allowForTag.has(name)) el.removeAttribute(attr.name)
                    } else {
                        // для тегов без спец-списка разрашим только title
                        if (name !== 'title') el.removeAttribute(attr.name)
                    }
                }
            }
        }

        // обходим копию списка, т.к. дерево может мутировать
        for (const child of Array.from(node.childNodes)) {
            walk(child)
        }
    }

    walk(container)

    // 4) безопасные значения по умолчанию для ссылок
    for (const a of Array.from(container.querySelectorAll('a'))) {
        a.setAttribute('rel', 'noopener noreferrer')
        if (!a.getAttribute('target')) a.setAttribute('target', '_blank')
    }

    return container.innerHTML
}

/** Простой детектор “похоже на HTML со стилем Zephyr” */
function looksLikeHtml(s: string) {
    return /<\s*(strong|b|em|i|u|code|pre|br|p|div|ol|ul|li|h[1-6]|a|img)\b/i.test(s)
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
    const [active, setActive] = React.useState(false)

    const MAX_AUTO_HEIGHT = 600 // px

    // локальные команды для тулбара
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

    // выдать API наружу — опц.
    React.useEffect(() => {
        if (!apiRef) return
        apiRef.current = {
            wrap: doWrap,
            insertPrefix: doInsertPrefix,
            focus: () => taRef.current?.focus(),
        }
        return () => { if (apiRef) apiRef.current = null }
    }, [apiRef, doWrap, doInsertPrefix])

    // автогроу
    const autoGrow = React.useCallback((el: HTMLTextAreaElement) => {
        el.style.height = 'auto'
        let target = el.scrollHeight
        if (preview && previewRef.current) {
            target = Math.max(target, previewRef.current.scrollHeight)
        }
        const final = Math.min(target, MAX_AUTO_HEIGHT)
        el.style.height = `${final}px`
        el.style.overflowY = target > MAX_AUTO_HEIGHT ? 'auto' : 'hidden'
    }, [preview])

    React.useLayoutEffect(() => {
        if (taRef.current) autoGrow(taRef.current)
    }, [value, preview, autoGrow])

    React.useEffect(() => {
        const onResize = () => { if (taRef.current) autoGrow(taRef.current) }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [autoGrow])

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
        const r = el.getBoundingClientRect()
        setAnchor({ top: r.bottom + window.scrollY, left: r.left + window.scrollX + 8 })
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
        if (taRef.current) autoGrow(taRef.current)
    }
    function onClickOrKeyUp() {
        const el = taRef.current
        if (!el) return
        updateSuggestions(el)
    }

    React.useEffect(() => {
        const onScroll = () => setAcOpen(false)
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [])

    /* ─────────── Превью: Markdown ИЛИ Санитизированный HTML ─────────── */

    function renderPreviewHtml(input: string) {
        const src = typeof resolveRefs === 'function' ? resolveRefs(input ?? '') : (input ?? '')
        if (looksLikeHtml(src)) {
            return sanitizeHtml(src)
        } else {
            return mdToHtml(normalizeImageWikiRefs(src, resolveRefs))
        }
    }

    // тулбар
    const toolbar = !hideToolbar && active && !preview ? (
        <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
            <button className="md-btn" title="Bold" onClick={() => doWrap('**', '**')}>B</button>
            <button className="md-btn" title="Italic" onClick={() => doWrap('*', '*')}><i>I</i></button>
            <button className="md-btn" title="Underline" onClick={() => doWrap('__', '__')}><u>U</u></button>
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

    return (
        <div className={`md-editor ${className || ''}`}>
            {toolbar}
            <div className="md-input-wrap">
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
                if (el) { updateSuggestions(el); autoGrow(el) }
            }}
            onBlur={() => { setActive(false); setAcOpen(false) }}
            placeholder={placeholder}
            rows={rows}
            className="md-textarea"
        />

                {preview && (
                    <div
                        ref={previewRef}
                        className="md-preview"
                        /* ВНИМАНИЕ: HTML уже санитизирован в renderPreviewHtml */
                        dangerouslySetInnerHTML={{ __html: renderPreviewHtml(value) }}
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
