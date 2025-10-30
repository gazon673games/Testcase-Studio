import * as React from 'react'
import './MarkdownEditor.css'

/**
 * Минимальный контракт теста/шага для [[wiki-refs]] автокомплита.
 * Никаких зависимостей от @core/domain — компонент переиспользуемый.
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
    /** Обернуть выделение в before/after */
    wrap(before: string, after: string): void
    /** Добавить префикс в начало выделенных строк */
    insertPrefix(prefix: string): void
    /** Фокус в textarea */
    focus(): void
}

export type MarkdownEditorProps = {
    value: string
    onChange(v: string): void
    placeholder?: string
    rows?: number

    /** Включить режим предварительного просмотра */
    preview?: boolean
    /** Коллбек для внешнего тоггла превью (опционально) */
    onTogglePreview?: () => void

    /** Резолвер [[wiki-refs]] перед Markdown→HTML (опционально) */
    resolveRefs?: (src: string) => string
    /** Данные для автокомплита [[...]] */
    allTests?: RefTest[]

    /** Выдать наружу API тулбара */
    apiRef?: React.MutableRefObject<MarkdownEditorApi | null>

    /** Скрыть тулбар (например, в very-compact местах) */
    hideToolbar?: boolean

    /** Дополнительный className на корне */
    className?: string
}

/** Утилита: безопасный html-escape */
function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Простой безопасный Markdown → HTML (поддержка **,*,__,`, [link], ![img], списки) */
export function mdToHtml(src: string): string {
    const lines = src.split('\n')
    const out: string[] = []
    let inUl = false,
        inOl = false
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
        const t = line.trim()
        if (/^-\s+/.test(t)) {
            if (!inUl) {
                flush()
                out.push('<ul style="margin:0 0 0 20px; padding:0">')
                inUl = true
            }
            line = t.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        if (/^\d+\.\s+/.test(t)) {
            if (!inOl) {
                flush()
                out.push('<ol style="margin:0 0 0 20px; padding:0">')
                inOl = true
            }
            line = t.replace(/^\d+\.\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        flush()
        if (t.length === 0) {
            out.push('<br/>')
            continue
        }
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
    x = x.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img alt="$1" src="$2" style="max-width:100%; vertical-align:middle;" />'
    )
    x = x.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    return x
}

/** Утилита: усечение для превью пунктов автокомплита */
function trimText(s: string, n = 60) {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim()
    return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/** Преобразуем ![[...]] в ![](resolved), если доступен resolveRefs */
function normalizeImageWikiRefs(
    src: string,
    resolveRefs?: (s: string) => string
) {
    // ![[something]] -> ![](resolved(something))
    return src.replace(/!\[\[([^[\]]+)\]\]/g, (_m, body: string) => {
        const inside = `[[${String(body).trim()}]]`
        const resolved = resolveRefs ? resolveRefs(inside) : inside
        if (!resolved || resolved.startsWith('[[')) return _m // резолв не удался — оставим как есть
        return `![](${resolved})`
    })
}

/** Сам редактор */
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
    const [active, setActive] = React.useState(false) // показывать тулбар при фокусе

    /** Максимальная авто-высота для textarea (после — даём нативный скролл) */
    const MAX_AUTO_HEIGHT = 600 // px

    // API наружу
    React.useEffect(() => {
        if (!apiRef) return
        apiRef.current = {
            wrap(before, after) {
                const el = taRef.current
                if (!el) return
                const start = Math.min(el.selectionStart, el.selectionEnd)
                const end = Math.max(el.selectionStart, el.selectionEnd)
                const left = value.slice(0, start)
                const mid = value.slice(start, end)
                const right = value.slice(end)
                onChange(left + before + mid + after + right)
                requestAnimationFrame(() => {
                    el.selectionStart =
                        el.selectionEnd = start + before.length + mid.length + after.length
                    el.focus()
                })
            },
            insertPrefix(prefix) {
                const el = taRef.current
                if (!el) return
                const lines = value.split('\n')
                const s = el.selectionStart,
                    e = el.selectionEnd
                let sLine = 0,
                    eLine = lines.length - 1
                for (let i = 0, acc = 0; i < lines.length; i++, acc += lines[i].length + 1) {
                    if (acc + lines[i].length >= s) {
                        sLine = i
                        break
                    }
                }
                for (let i = sLine; i < lines.length; i++) {
                    const lineStart = lines.slice(0, i).join('\n').length + (i ? 1 : 0)
                    const lineEnd = lineStart + lines[i].length
                    if (lineEnd >= e) {
                        eLine = i
                        break
                    }
                }
                for (let j = sLine; j <= eLine; j++) {
                    lines[j] = lines[j].length ? `${prefix} ${lines[j]}` : `${prefix} `
                }
                onChange(lines.join('\n'))
                requestAnimationFrame(() => el.focus())
            },
            focus() {
                taRef.current?.focus()
            },
        }
        return () => {
            if (apiRef) apiRef.current = null
        }
    }, [apiRef, onChange, value])

    // автогроу textarea с учётом превью
    const autoGrow = React.useCallback(
        (el: HTMLTextAreaElement) => {
            // сбрасываем высоту перед измерением
            el.style.height = 'auto'
            let target = el.scrollHeight

            // если превью включено — учтём её содержимое (картинки/списки могут быть выше)
            if (preview) {
                const pr = previewRef.current
                if (pr) {
                    const ph = pr.scrollHeight
                    if (ph > target) target = ph
                }
            }

            // ограничиваем сверху, дальше — нативный скролл
            const final = Math.min(target, MAX_AUTO_HEIGHT)
            el.style.height = `${final}px`
            el.style.overflowY = target > MAX_AUTO_HEIGHT ? 'auto' : 'hidden'
        },
        [preview]
    )

    React.useLayoutEffect(() => {
        if (taRef.current) autoGrow(taRef.current)
    }, [value, preview, autoGrow])

    React.useEffect(() => {
        const onResize = () => {
            if (taRef.current) autoGrow(taRef.current)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [autoGrow])

    // ───── состояние автокомплита [[...]]
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
            setAcOpen(false)
            setRange(null)
            return
        }
        const q = before.slice(start + 2)

        const r = el.getBoundingClientRect()
        setAnchor({ top: r.bottom + window.scrollY, left: r.left + window.scrollX + 8 })
        setRange({ from: start, to: caret })

        const hashPos = q.indexOf('#')
        if (hashPos === -1) {
            const qTest = q.trim().toLowerCase()
            const tests = allTests
                .filter((t) => t.name.toLowerCase().includes(qTest))
                .slice(0, 20)
                .map((t) => ({ label: `📄 ${t.name}`, insert: `${t.name}` }))
            setAcItems(tests)
            setAcIndex(0)
            setAcOpen(tests.length > 0)
            return
        } else {
            const testName = q.slice(0, hashPos).trim()
            const stepFilter = q.slice(hashPos + 1).trim().toLowerCase()
            const test = allTests.find((t) => t.name.toLowerCase().startsWith(testName.toLowerCase()))
            if (!test) {
                setAcOpen(false)
                return
            }
            const items: Array<{ label: string; insert: string }> = []
            test.steps.forEach((s, i) => {
                const idx = i + 1
                const head = (s.action || s.text || '') as string
                const data = (s.data || '') as string
                const exp = (s.expected || '') as string
                const variants = [
                    { suffix: '', txt: head },
                    { suffix: '.data', txt: data },
                    { suffix: '.expected', txt: exp },
                ]
                for (const v of variants) {
                    const label = `#${idx}${v.suffix} — ${trimText(head || data || exp)}`
                    const ins = `${test.name}#${idx}${v.suffix}`
                    const hay = (
                        String(idx) +
                        ' ' +
                        v.suffix +
                        ' ' +
                        head +
                        ' ' +
                        data +
                        ' ' +
                        exp
                    ).toLowerCase()
                    if (hay.includes(stepFilter)) items.push({ label, insert: ins })
                }
            })
            const limited = items.slice(0, 50)
            setAcItems(limited)
            setAcIndex(0)
            setAcOpen(limited.length > 0)
            return
        }
    }

    function applySuggestion(item: { label: string; insert: string }) {
        const el = taRef.current
        if (!el || !range) return
        const left = value.slice(0, range.from)
        const right = value.slice(range.to)
        const newVal = `${left}[[${item.insert}]]${right}`
        onChange(newVal)
        const pos = (left + '[[' + item.insert + ']]').length
        requestAnimationFrame(() => {
            el.focus()
            el.selectionStart = el.selectionEnd = pos
        })
        setAcOpen(false)
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!acOpen) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAcIndex((i) => Math.min(i + 1, acItems.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAcIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            const it = acItems[acIndex]
            if (it) applySuggestion(it)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setAcOpen(false)
        }
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

    // закрыть попап при любом скролле
    React.useEffect(() => {
        const onScroll = () => setAcOpen(false)
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [])

    // тулбар — показываем только при фокусе и когда не hideToolbar
    const toolbar = !hideToolbar && active && !preview ? (
        <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
            <button className="md-btn" title="Bold" onClick={() => apiRef?.current?.wrap('**', '**')}>
                B
            </button>
            <button className="md-btn" title="Italic" onClick={() => apiRef?.current?.wrap('*', '*')}>
                <i>I</i>
            </button>
            <button className="md-btn" title="Underline" onClick={() => apiRef?.current?.wrap('__', '__')}>
                <u>U</u>
            </button>
            <div className="divider" />
            <button className="md-btn" title="Bulleted list" onClick={() => apiRef?.current?.insertPrefix('-')}>
                •
            </button>
            <button className="md-btn" title="Numbered list" onClick={() => apiRef?.current?.insertPrefix('1.')}>
                1.
            </button>
            <div className="divider" />
            <button className="md-btn" title="Code" onClick={() => apiRef?.current?.wrap('`', '`')}>
                {'</>'}
            </button>
            <button className="md-btn" title="Link" onClick={() => apiRef?.current?.wrap('[', '](url)')}>
                🔗
            </button>
            <button className="md-btn" title="Image" onClick={() => apiRef?.current?.wrap('![', '](image.png)')}>
                🖼️
            </button>
            {typeof onTogglePreview === 'function' && (
                <>
                    <div className="divider" />
                    <button className="md-btn" title="Toggle preview" onClick={onTogglePreview}>
                        Preview
                    </button>
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
                if (el) {
                    updateSuggestions(el)
                    autoGrow(el)
                }
            }}
            onBlur={() => {
                setActive(false)
                setAcOpen(false)
            }}
            placeholder={placeholder}
            rows={rows}
            className="md-textarea"
        />

                {/* overlay preview поверх textarea */}
                {preview && (
                    <div
                        ref={previewRef}
                        className="md-preview"
                        dangerouslySetInnerHTML={{
                            __html: mdToHtml(
                                resolveRefs
                                    ? resolveRefs(normalizeImageWikiRefs(value, resolveRefs))
                                    : normalizeImageWikiRefs(value)
                            ),
                        }}
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

/* ───────────────────────────────────────────────────────────── */
/* Внутренний компонент автокомплита */

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
                                                             top,
                                                             left,
                                                             items,
                                                             index,
                                                             onPick,
                                                             onClose,
                                                         }) => {
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    React.useEffect(() => {
        const onScroll = () => onClose()
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [onClose])

    return (
        <div
            className="autocomplete"
            style={{ top, left }}
            role="listbox"
            aria-label="Wiki references suggestions"
        >
            {items.length === 0 ? (
                <div className="autocomplete-empty">No matches</div>
            ) : (
                items.map((it, i) => (
                    <div
                        key={`${it.insert}-${i}`}
                        onMouseDown={(e) => {
                            e.preventDefault()
                            onPick(it)
                        }}
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
