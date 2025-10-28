// src/ui/TestEditor.tsx
import * as React from 'react'
import type { TestCase, Step, PartItem, TestMeta } from '@core/domain'

type Props = {
    test: TestCase
    onChange: (patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta'>>) => void
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

    // по умолчанию свёрнуто
    const [showSteps, setShowSteps] = React.useState(false)
    const [showAttachments, setShowAttachments] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [showMeta, setShowMeta] = React.useState(false)

    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    React.useEffect(() => {
        setName(test.name)
        setDesc(test.description ?? '')
        setSteps(test.steps)
        setMeta(test.meta ?? { tags: [] })
        setShowSteps(false)
        setShowAttachments(false)
        setShowDetails(false)
        setShowMeta(false)
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

    // даём родителю возможность применить драфт перед глобальным Save
    React.useImperativeHandle(ref, () => ({ commit: savePatch }), [name, desc, steps, meta])

    /* ───────────── wiki-refs для превью ───────────── */
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

    // mock-attach
    function attachMock(idx: number) {
        const name = prompt('Attachment name (mock):', 'example.txt')
        if (!name) return
        const s = structuredClone(steps[idx])
        if (!s.internal) s.internal = {}
        if (!s.internal.meta) s.internal.meta = {}
        const arr = Array.isArray((s.internal.meta as any).attachments) ? (s.internal.meta as any).attachments as string[] : []
        ;(s.internal.meta as any).attachments = [...arr, name]
        updateStep(idx, s)
    }

    function removeStep(idx: number) {
        setSteps(steps.filter((_, i) => i !== idx))
    }


    const SectionHeader = (
        { title, open, count, onToggle }:
            { title: string; open: boolean; count?: number; onToggle(): void }
    ) => (
        <button
            type="button"
            onClick={onToggle}
            data-spoiler
            data-nopress
            style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'8px 10px', margin:'12px 0 6px',
                borderRadius:8, border:'1px solid #e5e5e5', background:'#fafafa',
                cursor:'pointer', fontWeight:600
            }}
        >
            <span style={{ width:14, textAlign:'center' }}>{open ? '▾' : '▸'}</span>
            <span>{title}{typeof count === 'number' ? ` (${count})` : ''}</span>
        </button>
    )

    /* ───────────────────────── UI ───────────────────────── */

    return (
        <div style={{ padding: 12 }}>
            {/* title */}
            <div style={{ marginBottom: 8 }}>
                <label style={{ display:'block', fontSize:12, color:'#555' }}>Name</label>
                <input
                    value={name}
                    onChange={e=>setName(e.target.value)}
                    onBlur={savePatch}
                    style={{ width:'100%', padding:'10px 12px', fontSize:14, borderRadius:8, boxSizing:'border-box' }}
                    placeholder="Enter test name…"
                />
            </div>

            {/* 1) STEPS — (по умолчанию скрыты) */}
            <SectionHeader title="Steps (table view)" open={showSteps} count={steps.length} onToggle={() => setShowSteps(s=>!s)} />
            {showSteps && (
                <div style={{ border:'1px solid #eee', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', background:'#f6f7fb', fontWeight:600, fontSize:12, color:'#444' }}>
                        <div style={thCell}>Action</div>
                        <div style={thCell}>Data</div>
                        <div style={thCell}>Expected</div>
                    </div>

                    {steps.map((s, i) => (
                        <StepRow
                            key={s.id}
                            ref={(el) => { stepRefs.current[s.id] = el }}
                            index={i}
                            step={s}
                            onAttach={() => attachMock(i)}
                            onClone={() => cloneStep(i)}
                            onAddNext={() => addStepAfter(i)}
                            onRemove={() => removeStep(i)}
                            onEditTop={(patch) => updateStep(i, patch)}
                            onAddPart={addPart}
                            onEditPart={editPart}
                            onRemovePart={removePart}
                            resolveRefs={resolveRefs}
                            allTests={allTests}
                        />
                    ))}

                    <div style={{ padding:8, borderTop:'1px solid #eee' }}>
                        <button onClick={() => addStepAfter(steps.length - 1)} style={btnSmall}>+ Add step</button>
                        <button onClick={savePatch} style={{ ...btnSmall, marginLeft:6 }}>Apply</button>
                    </div>
                </div>
            )}

            {/* 2) DETAILS SPOILER */}
            <SectionHeader title="Details" open={showDetails} onToggle={() => setShowDetails(s=>!s)} />
            {showDetails && (
                <div style={cardBox}>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ display:'block', fontSize:12, color:'#555' }}>Description</label>
                        <textarea
                            value={desc}
                            onChange={e=>setDesc(e.target.value)}
                            onBlur={savePatch}
                            rows={4}
                            style={{ width:'100%', padding:'10px 12px', fontSize:14, borderRadius:8, boxSizing:'border-box' }}
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

            {/* 3) ATTACHMENTS */}
            <SectionHeader title="Attachments (test level)" open={showAttachments} count={test.attachments.length} onToggle={() => setShowAttachments(s=>!s)} />
            {showAttachments && (
                <div style={{ border:'1px dashed #ddd', padding:12, borderRadius:8, color:'#666' }}>
                    View-only for now: {test.attachments.length} file(s). (Adding UI later)
                </div>
            )}

            {/* 4) PARAMETERS */}
            <SectionHeader title="Parameters" open={showMeta} onToggle={() => setShowMeta(s=>!s)} />
            {showMeta && (
                <MetaCard meta={meta} onChange={(m) => { setMeta(m); onChange({ meta: m }) }} />
            )}
        </div>
    )
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Meta + Tags card (EN labels) */

function MetaCard({ meta, onChange }: { meta: TestMeta; onChange(m: TestMeta): void }) {
    const m = meta ?? { tags: [] }
    const set = (k: keyof TestMeta, v: string) => onChange({ ...m, [k]: v })
    const setTags = (tags: string[]) => onChange({ ...m, tags })

    return (
        <div style={metaCard}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:10 }}>
                <LabeledInput label="Status" value={m.status ?? ''} onChange={v=>set('status', v)} />
                <LabeledInput label="Priority" value={m.priority ?? ''} onChange={v=>set('priority', v)} />
                <LabeledInput label="Component" value={m.component ?? ''} onChange={v=>set('component', v)} />
                <LabeledInput label="Owner" value={m.owner ?? ''} onChange={v=>set('owner', v)} />
                <LabeledInput label="Folder" value={m.folder ?? ''} onChange={v=>set('folder', v)} />
                <LabeledInput label="Estimated Time" value={m.estimated ?? ''} onChange={v=>set('estimated', v)} />
                <LabeledInput label="Test Type" value={m.testType ?? ''} onChange={v=>set('testType', v)} />
                <LabeledInput label="Automation" value={m.automation ?? ''} onChange={v=>set('automation', v)} />
                <LabeledInput label="Assigned To" value={m.assignedTo ?? ''} onChange={v=>set('assignedTo', v)} />
            </div>

            <div style={{ marginTop: 10 }}>
                <label style={labelSm}>Tags</label>
                <TagsEditor value={m.tags ?? []} onChange={setTags} />
            </div>
        </div>
    )
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
    return (
        <div>
            <label style={labelSm}>{label}</label>
            <input
                value={value}
                onChange={e=>onChange(e.target.value)}
                style={input}
                placeholder={label}
            />
        </div>
    )
}

function TagsEditor({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
    const [draft, setDraft] = React.useState('')
    const add = (t: string) => {
        const tag = t.trim()
        if (!tag) return
        if (value.includes(tag)) { setDraft(''); return }
        onChange([...value, tag]); setDraft('')
    }
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault(); add(draft)
        } else if (e.key === 'Backspace' && draft === '' && value.length) {
            onChange(value.slice(0, -1))
        }
    }
    const remove = (tag: string) => onChange(value.filter(t => t !== tag))

    return (
        <div style={tagsBox}>
            {value.map(t => (
                <span key={t} style={tagChip}>{t}<button onClick={()=>remove(t)} style={tagX} title="Remove">×</button></span>
            ))}
            <input
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                onKeyDown={onKey}
                onBlur={() => add(draft)}
                placeholder="Add tag…"
                style={{ ...input, border:'none', outline:'none', minWidth: 120 }}
            />
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown Block with toolbar + preview (без wiki-refs здесь) */
function MdBlock({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
    const [preview, setPreview] = React.useState(false)
    const mdRef = React.useRef<MdApi | null>(null)
    const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (bp) => (
        <button {...bp} style={{ ...iconBtn, padding:'2px 6px', marginLeft: 4 }} />
    )

    return (
        <div style={{ marginTop: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label style={{ display:'block', fontSize:12, color:'#555' }}>{label}</label>
                <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:12, color:'#666' }}>View:</span>
                    <Btn onClick={()=>setPreview(p=>!p)}>{preview ? 'Raw' : 'Preview'}</Btn>
                </div>
            </div>

            <div style={{ display:'flex', gap:4, margin:'6px 0' }}>
                <Btn title="Bold" onClick={()=>mdRef.current?.wrap('**','**')}>B</Btn>
                <Btn title="Italic" onClick={()=>mdRef.current?.wrap('*','*')}><i>I</i></Btn>
                <Btn title="Underline" onClick={()=>mdRef.current?.wrap('__','__')}><u>U</u></Btn>
                <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                <Btn title="Bulleted list" onClick={()=>mdRef.current?.insertPrefix('-')}>•</Btn>
                <Btn title="Numbered list" onClick={()=>mdRef.current?.insertPrefix('1.')}>1.</Btn>
                <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                <Btn title="Code" onClick={()=>mdRef.current?.wrap('`','`')}>{'</>'}</Btn>
                <Btn title="Link" onClick={()=>mdRef.current?.wrap('[','](url)')}>🔗</Btn>
                <Btn title="Image" onClick={()=>mdRef.current?.wrap('![','](image.png)')}>🖼️</Btn>
            </div>

            <MdArea value={value} onChange={onChange} rows={4} preview={preview} apiRef={mdRef} placeholder={label} />
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Styles */
const thCell: React.CSSProperties = { padding:'8px 10px', borderRight:'1px solid #e9e9e9' }
const btnSmall: React.CSSProperties = { padding:'4px 8px', fontSize:12, border:'1px solid #ccc', borderRadius:6, background:'#f7f7f7' }
const iconBtn: React.CSSProperties = { border:'1px solid #ddd', background:'#fff', borderRadius:6, padding:'1px 5px', cursor:'pointer', fontSize:11 }

const labelSm: React.CSSProperties = { display:'block', fontSize:12, color:'#555', marginBottom:4 }
const input: React.CSSProperties = {
    width:'100%', padding:'8px 10px', fontSize:13, borderRadius:8, border:'1px solid #ccc', boxSizing:'border-box'
}
const metaCard: React.CSSProperties = {
    border: '1px solid #e5e5e5', borderRadius: 10, padding: 12, background:'#fafafa'
}

const cardBox: React.CSSProperties = {
    border: '1px solid #eee', borderRadius: 10, padding: 10, background:'#fff'
}

const tagsBox: React.CSSProperties = {
    display:'flex', flexWrap:'wrap', gap:6, padding:6, border:'1px dashed #cfcfcf',
    borderRadius:8, background:'#fff'
}
const tagChip: React.CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px', borderRadius:999,
    border:'1px solid #d7e3ff', background:'#eef4ff', fontSize:12
}
const tagX: React.CSSProperties = {
    border:'none', background:'transparent', cursor:'pointer', fontSize:12, color:'#555'
}

const previewBox: React.CSSProperties = {
    width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff',
    whiteSpace:'pre-wrap', overflowWrap:'anywhere', boxSizing:'border-box'
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Markdown textarea с API + preview, wiki-refs и автодополнением [[...]] */
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
    }
    function onClickOrKeyUp() {
        const el = ref.current; if (!el) return
        updateSuggestions(el)
    }
    function onFocus() { const el = ref.current; if (el) updateSuggestions(el) }

    const content = preview
        ? (
            <div style={previewBox} dangerouslySetInnerHTML={{ __html: mdToHtml(resolveRefs ? resolveRefs(value) : value) }} />
        )
        : (
            <div style={{ position:'relative' }}>
          <textarea
              ref={ref}
              value={value}
              onChange={onChangeWrapped}
              onKeyDown={onKeyDown}
              onKeyUp={onClickOrKeyUp}
              onClick={onClickOrKeyUp}
              onFocus={onFocus}
              placeholder={placeholder}
              rows={rows}
              style={{
                  width:'100%',
                  padding:'10px 12px',
                  fontSize:14,
                  borderRadius:8,
                  border:'1px solid #ddd',
                  resize:'vertical',
                  boxSizing:'border-box'
              }}
          />
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
            style={{
                position: 'fixed',
                top,
                left,
                zIndex: 9999,
                width: 380,
                maxHeight: 260,
                overflow: 'auto',
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 8,
                boxShadow: '0 10px 30px rgba(0,0,0,.15)',
            }}
            role="listbox"
            aria-label="Wiki references suggestions"
        >
            {items.length === 0 ? (
                <div style={{ padding: 8, color: '#888' }}>No matches</div>
            ) : items.map((it, i) => (
                <div
                    key={`${it.insert}-${i}`}
                    onMouseDown={(e) => { e.preventDefault(); onPick(it) }}
                    style={{
                        padding: '6px 10px',
                        background: i === index ? 'rgba(22,119,255,.1)' : 'transparent',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        userSelect: 'none',
                    }}
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
    x = x.replace(/`([^`]+)`/g, '<code style="background:#f2f2f2; padding:0 3px; border-radius:4px;">$1</code>')
    x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    x = x.replace(/__([^_]+)__/g, '<u>$1</u>')
    x = x.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    x = x.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%; vertical-align:middle;" />')
    x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    return x
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Step row — Markdown + preview + parts + wiki-refs + подсказки */
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
}

function StepRowBase(props: StepRowProps, ref: React.Ref<HTMLDivElement>) {
    const { index, step } = props
    const [hover, setHover] = React.useState(false)
    const [preview, setPreview] = React.useState<{ action: boolean; data: boolean; expected: boolean }>({
        action: false, data: false, expected: false
    })
    const togglePreview = (k: 'action'|'data'|'expected') =>
        setPreview(p => ({ ...p, [k]: !p[k] }))

    const cell = (kind: 'action'|'data'|'expected') => {
        const topValue = (step as any)[kind] ?? ''
        const parts = step.internal?.parts?.[kind] ?? []
        const setTop = (v: string) => props.onEditTop({ [kind]: v, ...(kind==='action' ? { text: v } : {}) })
        const mdRef = React.useRef<MdApi | null>(null)
        const BarBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (bp) => (
            <button {...bp} style={{ ...iconBtn, padding:'2px 6px' }} />
        )

        return (
            <div style={{ padding:10, borderRight:'1px solid #f0f0f0' }}>
                {(hover || preview[kind]) && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginBottom:6 }}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            <BarBtn title="Bold" onClick={()=>mdRef.current?.wrap('**','**')}>B</BarBtn>
                            <BarBtn title="Italic" onClick={()=>mdRef.current?.wrap('*','*')}><i>I</i></BarBtn>
                            <BarBtn title="Underline" onClick={()=>mdRef.current?.wrap('__','__')}><u>U</u></BarBtn>
                            <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                            <BarBtn title="Bulleted list" onClick={()=>mdRef.current?.insertPrefix('-')}>•</BarBtn>
                            <BarBtn title="Numbered list" onClick={()=>mdRef.current?.insertPrefix('1.')}>1.</BarBtn>
                            <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                            <BarBtn title="Code" onClick={()=>mdRef.current?.wrap('`','`')}>{'</>'}</BarBtn>
                            <BarBtn title="Link" onClick={()=>mdRef.current?.wrap('[','](url)')}>🔗</BarBtn>
                            <BarBtn title="Image" onClick={()=>mdRef.current?.wrap('![','](image.png)')}>🖼️</BarBtn>
                        </div>

                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <span style={{ fontSize:12, color:'#666' }}>View:</span>
                            <BarBtn onClick={() => togglePreview(kind)}>{preview[kind] ? 'Raw' : 'Preview'}</BarBtn>
                            <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                            <BarBtn title="Attach (mock)" onClick={props.onAttach}>📎</BarBtn>
                            <BarBtn title="Clone step" onClick={props.onClone}>⎘</BarBtn>
                            <BarBtn title="Add next step" onClick={props.onAddNext}>＋</BarBtn>
                            <BarBtn title={`Add ${kind} part`} onClick={() => props.onAddPart(index, kind)}>▦</BarBtn>
                        </div>
                    </div>
                )}

                <MdArea
                    value={topValue}
                    onChange={setTop}
                    placeholder={`${kind[0].toUpperCase()+kind.slice(1)} (optional)…`}
                    apiRef={mdRef}
                    preview={preview[kind]}
                    resolveRefs={props.resolveRefs}
                    allTests={props.allTests}
                />

                {parts.length > 0 && (
                    <div style={{ marginTop:8, display:'grid', gap:8 }}>
                        {parts.map((p: PartItem, pi: number) => (
                            <PartItemRow
                                key={p.id}
                                label={`${kind} part #${pi+1}`}
                                value={p.text}
                                onChange={(v) => props.onEditPart(index, kind, pi, { text: v })}
                                onRemove={() => props.onRemovePart(index, kind, pi)}
                                preview={preview[kind]}
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
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderTop:'1px solid #eee', position:'relative' }}
        >
            <div style={{ position:'absolute', marginLeft:-28, display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ fontSize:12, color:'#999', marginTop:10 }}>{index+1}</div>
                {hover && <button onClick={props.onRemove} title="Remove step" style={iconBtn}>🗑️</button>}
            </div>

            {cell('action')}
            {cell('data')}
            {cell('expected')}
        </div>
    )
}

const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(StepRowBase)

/* Part row */
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
    const [hover, setHover] = React.useState(false)
    const SmallBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (bp) => (
        <button {...bp} style={{ ...iconBtn, padding:'1px 4px', fontSize:10 }} />
    )

    return (
        <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
            {(hover || preview) && (
                <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:6 }}>
                    <SmallBtn title="Bold" onClick={()=>mdRef.current?.wrap('**','**')}>B</SmallBtn>
                    <SmallBtn title="Italic" onClick={()=>mdRef.current?.wrap('*','*')}><i>I</i></SmallBtn>
                    <SmallBtn title="Underline" onClick={()=>mdRef.current?.wrap('__','__')}><u>U</u></SmallBtn>
                    <div style={{ width:1, background:'#e6e6e6', margin:'0 2px' }} />
                    <SmallBtn title="Code" onClick={()=>mdRef.current?.wrap('`','`')}>{'</>'}</SmallBtn>
                    <SmallBtn title="Link" onClick={()=>mdRef.current?.wrap('[','](url)')}>🔗</SmallBtn>
                    <SmallBtn title="Image" onClick={()=>mdRef.current?.wrap('![','](image.png)')}>🖼️</SmallBtn>
                    <span style={{ flex:1 }} />
                    <SmallBtn title="Remove part" onClick={onRemove}>×</SmallBtn>
                </div>
            )}
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
