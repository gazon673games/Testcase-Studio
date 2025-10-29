import * as React from 'react'
import './TestEditor.css'
import type { TestCase, Step, PartItem, TestMeta } from '@core/domain'
import { ParamsPanel } from './panels/MetaParamsPanel'
import './panels/MetaParamsPanel.css'
import { AttachmentsPanel } from './panels/AttachmentsPanel'
import './panels/AttachmentsPanel.css'

type Props = {
    test: TestCase
    onChange: (
        patch: Partial<
            Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments'>
        >
    ) => void
    focusStepId?: string | null
    allTests: TestCase[]
}

export type TestEditorHandle = { commit(): void }

export const TestEditor = React.forwardRef<TestEditorHandle, Props>(function TestEditor(
    { test, onChange, focusStepId, allTests }: Props,
    ref
) {
    const [name, setName] = React.useState(test.name)
    const [desc, setDesc] = React.useState(test.description ?? '')
    const [steps, setSteps] = React.useState<Step[]>(test.steps)
    const [meta, setMeta] = React.useState<TestMeta>(test.meta ?? { tags: [] })

    // секции
    const [showSteps, setShowSteps] = React.useState(true) // открыт по умолчанию
    const [showAttachments, setShowAttachments] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [showMeta, setShowMeta] = React.useState(false)

    // единый режим просмотра markdown по всем шагам
    const [globalPreview, setGlobalPreview] = React.useState(false)

    // адаптивный флаг для скрытия колонки номера
    const [isNarrow, setIsNarrow] = React.useState(false)
    React.useEffect(() => {
        const calc = () => setIsNarrow(window.innerWidth < 980)
        calc()
        window.addEventListener('resize', calc)
        return () => window.removeEventListener('resize', calc)
    }, [])

    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    React.useEffect(() => {
        setName(test.name)
        setDesc(test.description ?? '')
        setSteps(test.steps)
        setMeta(test.meta ?? { tags: [] })
        setShowSteps(true)
        setShowAttachments(false)
        setShowDetails(false)
        setShowMeta(false)
        setGlobalPreview(false)
        stepRefs.current = {}
    }, [test.id])

    React.useEffect(() => {
        if (!focusStepId) return
        setShowSteps(true)
        requestAnimationFrame(() => {
            const el = stepRefs.current[focusStepId]
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            if (el) {
                el.style.outline = '2px solid #8ab4f8'
                setTimeout(() => { if (el) el.style.outline = 'none' }, 900)
            }
        })
    }, [focusStepId])

    function savePatch() { onChange({ name, description: desc, steps, meta }) }
    React.useImperativeHandle(ref, () => ({ commit: savePatch }), [name, desc, steps, meta])

    /* ───────── wiki-refs для превью ───────── */
    const byName = React.useMemo(() => {
        const m = new Map<string, TestCase>()
        for (const t of allTests) m.set(t.name, t)
        return m
    }, [allTests])
    const byId = React.useMemo(() => {
        const m = new Map<string, TestCase>()
        for (const t of allTests) m.set(t.id, t)
        return m
    }, [allTests])

    function resolveOneRef(body: string): string | null {
        if (body.startsWith('id:')) {
            const rest = body.slice(3)
            const [testId, stepSpecRaw] = rest.split('#')
            if (!testId || !stepSpecRaw) return null
            const test = byId.get(testId.trim())
            if (!test) return null
            const [stepId, kindRaw] = stepSpecRaw.split('.')
            const st = test.steps.find(s => s.id === stepId?.trim())
            if (!st) return null
            const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action'|'data'|'expected'
            const val = (st as any)[kind] ?? st.text ?? ''
            return String(val ?? '')
        }
        const [testName, stepSpec] = body.split('#')
        if (!testName || !stepSpec) return null
        const test = byName.get(testName.trim())
        if (!test) return null
        const [idxRaw, kindRaw] = stepSpec.split('.')
        const idx = Number(idxRaw)
        if (!Number.isFinite(idx) || idx < 1 || idx > test.steps.length) return null
        const st = test.steps[idx - 1]
        const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action'|'data'|'expected'
        const val = (st as any)[kind] ?? st.text ?? ''
        return String(val ?? '')
    }

    const resolveRefs = React.useCallback((src: string) => {
        return src.replace(/\[\[([^[\]]+)\]\]/g, (_m, body: string) => {
            const v = resolveOneRef(String(body).trim())
            return v == null ? _m : v
        })
    }, [byName, byId])

    // helpers
    function ensureParts(s: Step) {
        if (!s.internal) s.internal = {}
        if (!s.internal.parts) s.internal.parts = {}
        if (!s.internal.parts.action) s.internal.parts.action = []
        if (!s.internal.parts.data) s.internal.parts.data = []
        if (!s.internal.parts.expected) s.internal.parts.expected = []
    }
    function updateStep(idx: number, patch: Partial<Step>) {
        const next = steps.map((s, i) => i === idx ? { ...s, ...patch } : s)
        setSteps(next)
    }
    function addStepAfter(idx: number) {
        const id = crypto.randomUUID()
        const newStep: Step = {
            id, action: '', data: '', expected: '', text: '',
            internal: { parts: { action: [], data: [], expected: [] } }, subSteps: []
        }
        const next = [...steps.slice(0, idx + 1), newStep, ...steps.slice(idx + 1)]
        setSteps(next)
    }
    function cloneStep(idx: number) {
        const src = steps[idx]
        const clone = structuredClone(src)
        clone.id = crypto.randomUUID()
        const next = [...steps.slice(0, idx + 1), clone, ...steps.slice(idx + 1)]
        setSteps(next)
    }
    function removeStep(idx: number) {
        setSteps(steps.filter((_, i) => i !== idx))
    }

    // mock-attach
    function attachMock(idx: number) {
        const name = prompt('Attachment name (mock):', 'example.txt')
        if (!name) return
        const s = structuredClone(steps[idx])
        if (!s.internal) s.internal = {}
        if (!s.internal.meta) s.internal.meta = {}
        const arr = Array.isArray((s.internal.meta as any).attachments)
            ? (s.internal.meta as any).attachments as string[] : []
        ;(s.internal.meta as any).attachments = [...arr, name]
        updateStep(idx, s)
    }

    function addPart(idx: number, kind: 'action'|'data'|'expected') {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        const list = (s.internal!.parts as any)[kind] as PartItem[]
        list.push({ id: crypto.randomUUID(), text: '' })
        updateStep(idx, s)
    }
    function editPart(idx: number, kind: 'action'|'data'|'expected', pIndex: number, patch: Partial<PartItem>) {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        const list = (s.internal!.parts as any)[kind] as PartItem[]
        list[pIndex] = { ...list[pIndex], ...patch }
        updateStep(idx, s)
    }
    function removePart(idx: number, kind: 'action'|'data'|'expected', pIndex: number) {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        const list = (s.internal!.parts as any)[kind] as PartItem[]
        list.splice(pIndex, 1)
        updateStep(idx, s)
    }

    // DnD
    const dragIndex = React.useRef<number | null>(null)
    function onDragStart(i: number) { dragIndex.current = i }
    function onDragOver(e: React.DragEvent) { e.preventDefault() }
    function onDrop(i: number) {
        const from = dragIndex.current
        dragIndex.current = null
        if (from == null || from === i) return
        const next = steps.slice()
        const [moved] = next.splice(from, 1)
        next.splice(i, 0, moved)
        setSteps(next)
    }

    return (
        <div className="test-editor">
            {/* title */}
            <div className="field">
                <label className="label-sm">Name</label>
                <input
                    value={name}
                    onChange={e=>setName(e.target.value)}
                    onBlur={savePatch}
                    className="input"
                    placeholder="Enter test name…"
                />
            </div>

            {/* STEPS */}
            <SectionHeader
                title="Steps"
                open={showSteps}
                count={steps.length}
                onToggle={() => setShowSteps(s=>!s)}
                right={
                    <div className="section-header-right">
                        <span className="muted">View:</span>
                        <button onClick={()=>setGlobalPreview(p=>!p)} className="btn-small">
                            {globalPreview ? 'Raw' : 'Preview'}
                        </button>
                        <button onClick={() => addStepAfter(steps.length - 1)} className="btn-small">
                            + Add step
                        </button>
                        <button onClick={savePatch} className="btn-small">Apply</button>
                    </div>
                }
            />
            {showSteps && (
                <div className="steps">
                    {/* без steps-head */}
                    {steps.map((s, i) => (
                        <StepRow
                            key={s.id}
                            ref={(el) => { stepRefs.current[s.id] = el }}
                            index={i}
                            step={s}
                            allTests={allTests}
                            resolveRefs={resolveRefs}
                            onAttach={() => attachMock(i)}
                            onClone={() => cloneStep(i)}
                            onAddNext={() => addStepAfter(i)}
                            onRemove={() => removeStep(i)}
                            onEditTop={(patch) => updateStep(i, patch)}
                            onAddPart={addPart}
                            onEditPart={editPart}
                            onRemovePart={removePart}
                            draggable
                            onDragStart={()=>onDragStart(i)}
                            onDragOver={onDragOver}
                            onDrop={()=>onDrop(i)}
                            preview={globalPreview}
                            isNarrow={isNarrow}
                        />
                    ))}
                </div>
            )}

            {/* DETAILS */}
            <SectionHeader title="Details" open={showDetails} onToggle={() => setShowDetails(s=>!s)} />
            {showDetails && (
                <div className="card-box">
                    <div className="field">
                        <label className="label-sm">Description</label>
                        <textarea
                            value={desc}
                            onChange={e=>setDesc(e.target.value)}
                            onBlur={savePatch}
                            rows={4}
                            className="input textarea"
                            placeholder="Optional general description…"
                        />
                    </div>

                    <MdBlock
                        label="Test Objective"
                        value={meta.objective ?? ''}
                        onChange={(v)=>{ const m = { ...meta, objective: v }; setMeta(m); onChange({ meta: m }) }}
                    />
                    <MdBlock
                        label="Preconditions"
                        value={meta.preconditions ?? ''}
                        onChange={(v)=>{ const m = { ...meta, preconditions: v }; setMeta(m); onChange({ meta: m }) }}
                    />
                </div>
            )}

            {/* ATTACHMENTS */}
            <SectionHeader
                title="Attachments"
                open={showAttachments}
                count={test.attachments.length}
                onToggle={() => setShowAttachments(s => !s)}
            />
            {showAttachments && (
                <AttachmentsPanel
                    attachments={test.attachments}
                    onChange={(next) => onChange({ attachments: next })}
                />
            )}

            {/* PARAMETERS */}
            <SectionHeader title="Parameters" open={showMeta} onToggle={() => setShowMeta(s=>!s)} />
            {showMeta && (
                <ParamsPanel
                    meta={meta}
                    onChange={(m) => { setMeta(m); onChange({ meta: m }) }}
                />
            )}
        </div>
    )
})

/* ────────────────────────────────────────────────────────────────────────── */

const SectionHeader = (
    { title, open, count, onToggle, right }:
        { title: string; open: boolean; count?: number; onToggle(): void; right?: React.ReactNode }
) => (
    <div className="section-header" data-spoiler data-nopress>
        <button type="button" onClick={onToggle}>
            <span style={{ width:14, textAlign:'center' }}>{open ? '▾' : '▸'}</span>
            <span>{title}{typeof count === 'number' ? ` (${count})` : ''}</span>
        </button>
        <span className="spacer" />
        {right}
    </div>
)
/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown Block (для Details) — оставляем прежнюю логику */
function MdBlock({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
    const [preview, setPreview] = React.useState(false)
    const mdRef = React.useRef<MdApi | null>(null)
    const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (bp) => (
        <button {...bp} className="btn-icon" style={{ padding:'2px 6px', marginLeft:4 }} />
    )

    return (
        <div className="md-block">
            <div className="md-block-head">
                <label className="label-sm">{label}</label>
                <div className="md-view">
                    <span className="muted">View:</span>
                    <Btn onClick={()=>setPreview(p=>!p)}>{preview ? 'Raw' : 'Preview'}</Btn>
                </div>
            </div>

            <div className="md-toolbar">
                <Btn title="Bold" onClick={()=>mdRef.current?.wrap('**','**')}>B</Btn>
                <Btn title="Italic" onClick={()=>mdRef.current?.wrap('*','*')}><i>I</i></Btn>
                <Btn title="Underline" onClick={()=>mdRef.current?.wrap('__','__')}><u>U</u></Btn>
                <div className="divider" />
                <Btn title="Bulleted list" onClick={()=>mdRef.current?.insertPrefix('-')}>•</Btn>
                <Btn title="Numbered list" onClick={()=>mdRef.current?.insertPrefix('1.')}>1.</Btn>
                <div className="divider" />
                <Btn title="Code" onClick={()=>mdRef.current?.wrap('`','`')}>{'</>'}</Btn>
                <Btn title="Link" onClick={()=>mdRef.current?.wrap('[','](url)')}>🔗</Btn>
                <Btn title="Image" onClick={()=>mdRef.current?.wrap('![','](image.png)')}>🖼️</Btn>
            </div>

            <MdArea value={value} onChange={onChange} rows={4} preview={preview} placeholder={label} />
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown textarea с API + preview, wiki-refs и автодополнением [[...]]:
   + toolbar появляется при фокусе поля;
   + автогроу без скролла и без ручки ресайза. */
type MdAreaProps = {
    value: string
    onChange(v: string): void
    placeholder?: string
    rows?: number
    preview?: boolean
    resolveRefs?: (src: string) => string
    apiRef?: React.MutableRefObject<MdApi | null>
    allTests?: TestCase[]
}
type MdApi = {
    wrap(before: string, after: string): void
    insertPrefix(prefix: string): void
    focus(): void
}

function MdArea(props: MdAreaProps) {
    const { value, onChange, placeholder, rows = 3, apiRef, preview, resolveRefs, allTests = [] } = props
    const ref = React.useRef<HTMLTextAreaElement | null>(null)
    const [active, setActive] = React.useState(false) // показывать тулбар

    // API наружу
    React.useEffect(() => {
        if (!apiRef) return
        apiRef.current = {
            wrap(before, after) {
                const el = ref.current; if (!el) return
                const start = Math.min(el.selectionStart, el.selectionEnd)
                const end   = Math.max(el.selectionStart, el.selectionEnd)
                const left = value.slice(0, start)
                const mid  = value.slice(start, end)
                const right= value.slice(end)
                onChange(left + before + mid + after + right)
                requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + before.length + mid.length + after.length
                    el.focus()
                })
            },
            insertPrefix(prefix) {
                const el = ref.current; if (!el) return
                const lines = value.split('\n')
                const s = el.selectionStart, e = el.selectionEnd
                let sLine = 0, eLine = lines.length - 1
                for (let i=0, acc=0; i<lines.length; i++, acc+=lines[i].length+1) { if (acc + lines[i].length >= s) { sLine = i; break } }
                for (let i=sLine; i<lines.length; i++) {
                    const lineStart = lines.slice(0, i).join('\n').length + (i ? 1 : 0)
                    const lineEnd   = lineStart + lines[i].length
                    if (lineEnd >= e) { eLine = i; break }
                }
                for (let j=sLine; j<=eLine; j++) lines[j] = lines[j].length ? `${prefix} ${lines[j]}` : `${prefix} `
                onChange(lines.join('\n'))
                requestAnimationFrame(() => el.focus())
            },
            focus() { ref.current?.focus() }
        }
        return () => { if (apiRef) apiRef.current = null }
    }, [apiRef, onChange, value])

    // автоувеличение высоты
    const autoGrow = React.useCallback((el: HTMLTextAreaElement) => {
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [])
    React.useLayoutEffect(() => {
        const el = ref.current
        if (el) autoGrow(el)
    }, [value, autoGrow])

    // ── состояние автодополнения [[...]]
    const [acOpen, setAcOpen]   = React.useState(false)
    const [acItems, setAcItems] = React.useState<Array<{ label: string, insert: string }>>([])
    const [acIndex, setAcIndex] = React.useState(0)
    const [anchor, setAnchor]   = React.useState<{top:number,left:number}|null>(null)
    const [range, setRange]     = React.useState<{from:number,to:number}|null>(null)

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
            const tests = allTests
                .filter(t => t.name.toLowerCase().includes(qTest))
                .slice(0, 20)
                .map(t => ({ label: `📄 ${t.name}`, insert: `${t.name}` }))
            setAcItems(tests)
            setAcIndex(0)
            setAcOpen(tests.length > 0)
            return
        } else {
            const testName = q.slice(0, hashPos).trim()
            const stepFilter = q.slice(hashPos + 1).trim().toLowerCase()
            const test = allTests.find(t => t.name.toLowerCase().startsWith(testName.toLowerCase()))
            if (!test) { setAcOpen(false); return }
            const items: Array<{label:string, insert:string}> = []
            test.steps.forEach((s, i) => {
                const idx = i + 1
                const head = (s.action || s.text || '').toString()
                const data = (s.data || '').toString()
                const exp  = (s.expected || '').toString()
                const variants = [
                    { suffix: '', txt: head },
                    { suffix: '.data', txt: data },
                    { suffix: '.expected', txt: exp }
                ]
                for (const v of variants) {
                    const label = `#${idx}${v.suffix} — ${trim(head || data || exp)}`
                    const ins = `${test.name}#${idx}${v.suffix}`
                    const hay = (String(idx) + ' ' + v.suffix + ' ' + head + ' ' + data + ' ' + exp).toLowerCase()
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
    function trim(s: string, n = 60) { const t = s.replace(/\s+/g,' ').trim(); return t.length > n ? t.slice(0,n-1)+'…' : t }

    function applySuggestion(item: {label:string, insert:string}) {
        const el = ref.current; if (!el || !range) return
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
        if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acItems.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            const it = acItems[acIndex]; if (it) applySuggestion(it)
        } else if (e.key === 'Escape') {
            e.preventDefault(); setAcOpen(false)
        }
    }

    function onChangeWrapped(e: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(e.target.value)
        updateSuggestions(e.target)
        autoGrow(e.target)
    }
    function onClickOrKeyUp() {
        const el = ref.current; if (!el) return
        updateSuggestions(el)
    }

    const content = (
        <div className="md-input-wrap">
            {/* тулбар показываем только когда не preview и есть фокус */}
            {!preview && active && (
                <div
                    className="md-toolbar"
                    onMouseDown={(e)=>e.preventDefault()} /* не даём терять фокус при клике по кнопкам */
                >
                    <button className="btn-icon" title="Bold" onClick={()=>apiRef?.current?.wrap('**','**')}>B</button>
                    <button className="btn-icon" title="Italic" onClick={()=>apiRef?.current?.wrap('*','*')}><i>I</i></button>
                    <button className="btn-icon" title="Underline" onClick={()=>apiRef?.current?.wrap('__','__')}><u>U</u></button>
                    <div className="divider" />
                    <button className="btn-icon" title="Bulleted list" onClick={()=>apiRef?.current?.insertPrefix('-')}>•</button>
                    <button className="btn-icon" title="Numbered list" onClick={()=>apiRef?.current?.insertPrefix('1.')}>1.</button>
                    <div className="divider" />
                    <button className="btn-icon" title="Code" onClick={()=>apiRef?.current?.wrap('`','`')}>{'</>'}</button>
                    <button className="btn-icon" title="Link" onClick={()=>apiRef?.current?.wrap('[','](url)')}>🔗</button>
                    <button className="btn-icon" title="Image" onClick={()=>apiRef?.current?.wrap('![','](image.png)')}>🖼️</button>
                </div>
            )}

            <textarea
                ref={ref}
                value={value}
                onChange={onChangeWrapped}
                onKeyDown={onKeyDown}
                onKeyUp={onClickOrKeyUp}
                onClick={onClickOrKeyUp}
                onFocus={()=>{ setActive(true); const el = ref.current; if (el) { updateSuggestions(el); autoGrow(el) }}}
                onBlur={()=>{ setActive(false); setAcOpen(false) }}
                placeholder={placeholder}
                rows={rows}
                className={`input textarea textarea-grow ${preview ? 'preview-mode' : ''}`}
            />

            {/* если preview включён, рендерим html поверх textarea */}
            {preview && (
                <div
                    className="md-preview overlay"
                    dangerouslySetInnerHTML={{ __html: mdToHtml(resolveRefs ? resolveRefs(value) : value) }}
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
    )

    return content
}

/* ────────────────────────────────────────────────────────────────────────── */
// Autocomplete UI

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
                                                             top, left, items, index, onPick, onClose
                                                         }) => {
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
            ) : items.map((it, i) => (
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
            ))}
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown → HTML (простой, безопасный) */
function escapeHtml(s: string) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function mdToHtml(src: string): string {
    const lines = src.split('\n')
    const out: string[] = []
    let inUl = false, inOl = false
    const flush = () => { if (inUl) { out.push('</ul>'); inUl = false } if (inOl) { out.push('</ol>'); inOl = false } }

    for (let line of lines) {
        const t = line.trim()
        if (/^-\s+/.test(t)) {
            if (!inUl) { flush(); out.push('<ul style="margin:0 0 0 20px; padding:0">'); inUl = true }
            line = t.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`); continue
        }
        if (/^\d+\.\s+/.test(t)) {
            if (!inOl) { flush(); out.push('<ol style="margin:0 0 0 20px; padding:0">'); inOl = true }
            line = t.replace(/^\d+\.\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`); continue
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

/* ────────────────────────────────────────────────────────────────────────── */
/* Step row — Zephyr-like */

type StepRowProps = {
    index: number
    step: Step
    onAttach(): void
    onClone(): void
    onAddNext(): void
    onRemove(): void
    onEditTop(patch: Partial<Step>): void
    onAddPart(idx: number, kind: 'action'|'data'|'expected'): void
    onEditPart(idx: number, kind: 'action'|'data'|'expected', pIndex: number, patch: Partial<PartItem>): void
    onRemovePart(idx: number, kind: 'action'|'data'|'expected', pIndex: number): void
    resolveRefs(src: string): string
    allTests: TestCase[]
    draggable?: boolean
    onDragStart?(): void
    onDragOver?(e: React.DragEvent): void
    onDrop?(): void
    preview: boolean
    isNarrow: boolean
}

function StepRowBase(props: StepRowProps, ref: React.Ref<HTMLDivElement>) {
    const { index, step, preview, isNarrow } = props

    const PartAddBtn = ({ kind }: { kind: 'action'|'data'|'expected' }) => (
        <button title={`Add ${kind} part`} onClick={() => props.onAddPart(index, kind)} className="add-part-btn">▦ Add part</button>
    )

    const cell = (kind: 'action'|'data'|'expected', label: string) => {
        const topValue = (step as any)[kind] ?? ''
        const parts = step.internal?.parts?.[kind] ?? []
        const setTop = (v: string) => props.onEditTop({ [kind]: v, ...(kind==='action' ? { text: v } : {}) })
        const mdRef = React.useRef<MdApi | null>(null)

        return (
            <div className="step-cell">
                <div className="cell-head">
                    <div className="cell-title">{label}</div>
                    <PartAddBtn kind={kind} />
                </div>

                <MdArea
                    value={topValue}
                    onChange={setTop}
                    placeholder={`${label}…`}
                    apiRef={mdRef}
                    preview={preview}
                    resolveRefs={props.resolveRefs}
                    allTests={props.allTests}
                />

                {parts.length > 0 && (
                    <div className="parts">
                        {parts.map((p: PartItem, pi: number) => (
                            <PartItemRow
                                key={p.id}
                                label={`${label} part #${pi+1}`}
                                value={p.text}
                                onChange={(v) => props.onEditPart(index, kind, pi, { text: v })}
                                onRemove={() => props.onRemovePart(index, kind, pi)}
                                preview={preview}
                                resolveRefs={props.resolveRefs}
                                allTests={props.allTests}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            ref={ref}
            draggable={props.draggable}
            onDragStart={props.onDragStart}
            onDragOver={props.onDragOver}
            onDrop={props.onDrop}
            className="step-card"
        >
            <div className="step-header">
                <div className="drag" title="Drag to reorder">≡</div>
                <div className="step-title">Step {index + 1}</div>
                <span className="spacer" />
                <button title="Attach (mock)" onClick={props.onAttach} className="btn-small">📎</button>
                <button title="Clone step" onClick={props.onClone} className="btn-small">⎘</button>
                <button title="Add next step" onClick={props.onAddNext} className="btn-small">＋</button>
                <button title="Remove step" onClick={props.onRemove} className="btn-small">🗑️</button>
            </div>

            <div className={`step-grid ${isNarrow ? 'stack' : ''}`}>
                {!isNarrow && (
                    <div className="step-num">
                        <div className="step-num-badge">{index + 1}</div>
                    </div>
                )}
                <div>{cell('action','Action')}</div>
                <div>{cell('data','Data')}</div>
                <div>{cell('expected','Expected result')}</div>
            </div>
        </div>
    )
}
const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(StepRowBase)

/* Part row: тулбар только при фокусе (через MdArea) */
function PartItemRow({
                         label, value, onChange, onRemove, preview, resolveRefs, allTests
                     }: {
    label: string
    value: string
    onChange(v: string): void
    onRemove(): void
    preview: boolean
    resolveRefs(src: string): string
    allTests: TestCase[]
}) {
    const mdRef = React.useRef<MdApi | null>(null)
    return (
        <div className="part-row">
            <div className="part-remove">
                <button className="btn-icon" title="Remove part" onClick={onRemove}>×</button>
            </div>
            <MdArea
                value={value}
                onChange={onChange}
                placeholder={label}
                rows={2}
                apiRef={mdRef}
                preview={preview}
                resolveRefs={resolveRefs}
                allTests={allTests}
            />
        </div>
    )
}
