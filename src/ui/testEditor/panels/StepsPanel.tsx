import * as React from 'react'
import type { Step, PartItem, TestCase, Attachment } from '@core/domain'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import StepAttachmentsPanel from './StepAttachmentsPanel'

type Props = {
    steps: Step[]
    onChange(next: Step[]): void
    allTests: TestCase[]
    resolveRefs(src: string): string
    /** Прокрутить/подсветить конкретный шаг по id (опц.) */
    focusStepId?: string | null
    /** Внешний “Apply” из родителя */
    onApply?: () => void
    /** Кастомный загрузчик файлов именно для шагов (опц.) */
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
}

export default function StepsPanel({
                                       steps,
                                       onChange,
                                       allTests,
                                       resolveRefs,
                                       focusStepId,
                                       onApply,
                                       onUploadStepFiles,
                                   }: Props) {
    const [open, setOpen] = React.useState(true)
    const [globalPreview, setGlobalPreview] = React.useState(false)
    const [isNarrow, setIsNarrow] = React.useState(false)

    React.useEffect(() => {
        const calc = () => setIsNarrow(window.innerWidth < 980)
        calc()
        window.addEventListener('resize', calc)
        return () => window.removeEventListener('resize', calc)
    }, [])

    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    React.useEffect(() => {
        if (!focusStepId) return
        setOpen(true)
        requestAnimationFrame(() => {
            const el = stepRefs.current[focusStepId]
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            if (el) {
                el.style.outline = '2px solid #8ab4f8'
                setTimeout(() => { if (el) el.style.outline = 'none' }, 900)
            }
        })
    }, [focusStepId])

    /* helpers */
    function ensureParts(s: Step) {
        if (!s.internal) s.internal = {}
        if (!(s.internal as any).parts) (s.internal as any).parts = {}
        const p = (s.internal as any).parts
        if (!Array.isArray(p.action)) p.action = []
        if (!Array.isArray(p.data)) p.data = []
        if (!Array.isArray(p.expected)) p.expected = []
    }
    function ensureStepAttachments(s: Step) {
        if (!s.internal) s.internal = {}
        const meta = (s.internal as any).meta ?? {}
        if (!Array.isArray(meta.attachments)) meta.attachments = []
        ;(s.internal as any).meta = meta
    }

    function updateStep(idx: number, patch: Partial<Step>) {
        const next = steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
        onChange(next)
    }

    function addStepAfter(idx: number) {
        const id = crypto.randomUUID()
        const newStep: Step = {
            id, action: '', data: '', expected: '', text: '',
            internal: { parts: { action: [], data: [], expected: [] }, meta: { attachments: [] } } as any,
            subSteps: []
        }
        const next = [...steps.slice(0, idx + 1), newStep, ...steps.slice(idx + 1)]
        onChange(next)
    }

    function cloneStep(idx: number) {
        const src = steps[idx]
        const clone = structuredClone(src)
        clone.id = crypto.randomUUID()
        const next = [...steps.slice(0, idx + 1), clone, ...steps.slice(idx + 1)]
        onChange(next)
    }
    function removeStep(idx: number) {
        const next = steps.filter((_, i) => i !== idx)
        onChange(next)
    }

    function addPart(idx: number, kind: 'action'|'data'|'expected') {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        ;(s.internal as any).parts[kind].push({ id: crypto.randomUUID(), text: '' } as PartItem)
        updateStep(idx, s)
    }
    function editPart(idx: number, kind: 'action'|'data'|'expected', pIndex: number, patch: Partial<PartItem>) {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        const list: PartItem[] = (s.internal as any).parts[kind]
        list[pIndex] = { ...list[pIndex], ...patch }
        updateStep(idx, s)
    }
    function removePart(idx: number, kind: 'action'|'data'|'expected', pIndex: number) {
        const s = structuredClone(steps[idx])
        ensureParts(s)
        const list: PartItem[] = (s.internal as any).parts[kind]
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
        onChange(next)
    }

    return (
        <>
            <div className="section-header" data-spoiler data-nopress>
                <button type="button" onClick={() => setOpen(s => !s)}>
                    <span style={{ width:14, textAlign:'center' }}>{open ? '▾' : '▸'}</span>
                    <span>Steps{typeof steps.length === 'number' ? ` (${steps.length})` : ''}</span>
                </button>
                <span className="spacer" />
                <div className="section-header-right">
                    <span className="muted">View:</span>
                    <button onClick={() => setGlobalPreview(p => !p)} className="btn-small">
                        {globalPreview ? 'Raw' : 'Preview'}
                    </button>
                    <button
                        onClick={() => addStepAfter(Math.max(steps.length - 1, -1))}
                        className="btn-small"
                    >
                        + Add step
                    </button>
                    {onApply && <button onClick={onApply} className="btn-small">Apply</button>}
                </div>
            </div>

            {open && (
                <div className="steps">
                    {steps.map((s, i) => (
                        <StepRow
                            key={s.id}
                            ref={(el) => { stepRefs.current[s.id] = el }}
                            index={i}
                            step={s}
                            allTests={allTests}
                            resolveRefs={resolveRefs}
                            onClone={() => cloneStep(i)}
                            onAddNext={() => addStepAfter(i)}
                            onRemove={() => removeStep(i)}
                            onEditTop={(patch) => updateStep(i, patch)}
                            onAddPart={addPart}
                            onEditPart={editPart}
                            onRemovePart={removePart}
                            draggable
                            onDragStart={() => onDragStart(i)}
                            onDragOver={onDragOver}
                            onDrop={() => onDrop(i)}
                            preview={globalPreview}
                            isNarrow={isNarrow}
                            // attachments helpers
                            getStepAttachments={() => {
                                const a = (s as any)?.internal?.meta?.attachments ?? []
                                return a as Attachment[]
                            }}
                            setStepAttachments={(next) => {
                                const base = structuredClone(s)
                                ensureStepAttachments(base)
                                ;(base.internal as any).meta.attachments = next
                                updateStep(i, { internal: base.internal } as Partial<Step>)
                            }}
                            onUploadStepFiles={onUploadStepFiles}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

/* ────────────────────────────────────────────────────────── */
/* Внутренние компоненты панели */

type StepRowProps = {
    index: number
    step: Step
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

    // attachments wiring
    getStepAttachments(): Attachment[]
    setStepAttachments(next: Attachment[]): void
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
}

const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(function StepRowBase(props, ref) {
    const { index, step, preview, isNarrow } = props

    const PartAddBtn = ({ kind }: { kind: 'action'|'data'|'expected' }) => (
        <button title={`Add ${kind} part`} onClick={() => props.onAddPart(index, kind)} className="add-part-btn">▦ Add part</button>
    )

    const cell = (kind: 'action'|'data'|'expected', label: string) => {
        const topValue = (step as any)[kind] ?? ''
        const parts = step.internal?.parts?.[kind] ?? []
        const setTop = (v: string) => props.onEditTop({ [kind]: v, ...(kind==='action' ? { text: v } : {}) })

        return (
            <div className="step-cell">
                <div className="cell-head">
                    <div className="cell-title">{label}</div>
                    <PartAddBtn kind={kind} />
                </div>

                <MarkdownEditor
                    value={topValue}
                    onChange={setTop}
                    placeholder={`${label}…`}
                    preview={preview}
                    resolveRefs={props.resolveRefs}
                    allTests={props.allTests as any}
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

    const stepAttachments = props.getStepAttachments()

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

            {/* attachments блока шага */}
            <div style={{ padding: isNarrow ? 10 : '10px 10px 12px' }}>
                <StepAttachmentsPanel
                    stepId={step.id}
                    attachments={stepAttachments}
                    onChange={props.setStepAttachments}
                    onUploadStepFiles={props.onUploadStepFiles}
                    accept="*/*"
                    compact
                />
            </div>
        </div>
    )
})

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
    return (
        <div className="part-row">
            <div className="part-remove">
                <button className="btn-icon" title="Remove part" onClick={onRemove}>×</button>
            </div>
            <MarkdownEditor
                value={value}
                onChange={onChange}
                placeholder={label}
                rows={2}
                preview={preview}
                resolveRefs={resolveRefs}
                allTests={allTests as any}
            />
        </div>
    )
}
