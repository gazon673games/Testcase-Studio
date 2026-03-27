import * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'
import { makeStepRef } from '@core/refs'
import type { Attachment, PartItem, SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import StepAttachmentsPanel from './StepAttachmentsPanel'

type OwnerContext = { type: 'test' | 'shared'; id: string }

type Props = {
    owner: OwnerContext
    steps: Step[]
    onChange(next: Step[]): void
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    focusStepId?: string | null
    onApply?: () => void
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onCreateSharedFromStep?: (step: Step, name?: string) => void | Promise<void>
    onOpenShared?: (sharedId: string, stepId?: string) => void
    onInsertText?: (text: string) => void | Promise<void>
}

type StepRowProps = {
    owner: OwnerContext
    index: number
    step: Step
    preview: boolean
    isNarrow: boolean
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    sharedById: Map<string, SharedStep>
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onClone(): void
    onAddNext(): void
    onRemove(): void
    onEditTop(patch: Partial<Step>): void
    onAddPart(idx: number, kind: 'action' | 'data' | 'expected'): void
    onEditPart(idx: number, kind: 'action' | 'data' | 'expected', partIndex: number, patch: Partial<PartItem>): void
    onRemovePart(idx: number, kind: 'action' | 'data' | 'expected', partIndex: number): void
    onHandleDragStart(e: React.DragEvent): void
    onHandleDragEnd(): void
    onCardDragOver(e: React.DragEvent): void
    onCardDragEnter(): void
    onCardDragLeave(): void
    onCardDrop(): void
    isDragging: boolean
    isDropTarget: boolean
    getStepAttachments(): Attachment[]
    setStepAttachments(next: Attachment[]): void
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
    onCreateSharedFromStep?: (step: Step, name?: string) => void | Promise<void>
    onOpenShared?: (sharedId: string, stepId?: string) => void
    onInsertText?: (text: string) => void | Promise<void>
}

export default function StepsPanel({
    owner,
    steps,
    onChange,
    allTests,
    sharedSteps,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    focusStepId,
    onApply,
    onUploadStepFiles,
    onActivateEditorApi,
    onCreateSharedFromStep,
    onOpenShared,
    onInsertText,
}: Props) {
    const [open, setOpen] = React.useState(true)
    const [globalPreview, setGlobalPreview] = React.useState(false)
    const [isNarrow, setIsNarrow] = React.useState(false)
    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const dragIndex = React.useRef<number | null>(null)
    const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
    const sharedById = React.useMemo(() => new Map(sharedSteps.map((item) => [item.id, item] as const)), [sharedSteps])

    React.useEffect(() => {
        const onResize = () => setIsNarrow(window.innerWidth < 980)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    React.useEffect(() => {
        if (!focusStepId) return
        setOpen(true)
        requestAnimationFrame(() => {
            const element = stepRefs.current[focusStepId]
            element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            if (!element) return
            element.style.outline = '2px solid #8ab4f8'
            setTimeout(() => {
                if (element) element.style.outline = 'none'
            }, 900)
        })
    }, [focusStepId])

    function ensureParts(step: Step) {
        if (!step.internal) step.internal = {}
        if (!step.internal.parts) step.internal.parts = {}
        if (!Array.isArray(step.internal.parts.action)) step.internal.parts.action = []
        if (!Array.isArray(step.internal.parts.data)) step.internal.parts.data = []
        if (!Array.isArray(step.internal.parts.expected)) step.internal.parts.expected = []
    }

    function updateStep(index: number, patch: Partial<Step> | Step) {
        const next = steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step))
        onChange(next)
    }

    function addStepAfter(index: number) {
        const newStep: Step = {
            id: crypto.randomUUID(),
            action: '',
            data: '',
            expected: '',
            text: '',
            raw: { action: '', data: '', expected: '' },
            internal: { parts: { action: [], data: [], expected: [] } },
            subSteps: [],
            attachments: [],
        }
        onChange([...steps.slice(0, index + 1), newStep, ...steps.slice(index + 1)])
    }

    function cloneStep(index: number) {
        const cloned = structuredClone(steps[index])
        cloned.id = crypto.randomUUID()
        onChange([...steps.slice(0, index + 1), cloned, ...steps.slice(index + 1)])
    }

    function removeStep(index: number) {
        onChange(steps.filter((_, stepIndex) => stepIndex !== index))
    }

    function addPart(index: number, kind: 'action' | 'data' | 'expected') {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.internal!.parts![kind]!.push({ id: crypto.randomUUID(), text: '' })
        updateStep(index, nextStep)
    }

    function editPart(index: number, kind: 'action' | 'data' | 'expected', partIndex: number, patch: Partial<PartItem>) {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.internal!.parts![kind]![partIndex] = {
            ...nextStep.internal!.parts![kind]![partIndex],
            ...patch,
        }
        updateStep(index, nextStep)
    }

    function removePart(index: number, kind: 'action' | 'data' | 'expected', partIndex: number) {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.internal!.parts![kind]!.splice(partIndex, 1)
        updateStep(index, nextStep)
    }

    function onHandleDragStart(index: number, e: React.DragEvent) {
        dragIndex.current = index
        setDraggingIndex(index)
        setHoverIndex(null)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
    }

    function onHandleDragEnd() {
        dragIndex.current = null
        setDraggingIndex(null)
        setHoverIndex(null)
    }

    function onCardDragOver(e: React.DragEvent) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    function onCardDragEnter(index: number) {
        if (draggingIndex != null && index !== draggingIndex) setHoverIndex(index)
    }

    function onCardDragLeave(index: number) {
        if (hoverIndex === index) setHoverIndex(null)
    }

    function onCardDrop(index: number) {
        const from = dragIndex.current
        dragIndex.current = null
        setDraggingIndex(null)
        setHoverIndex(null)
        if (from == null || from === index) return

        const next = steps.slice()
        const [moved] = next.splice(from, 1)
        next.splice(index, 0, moved)
        onChange(next)
    }

    return (
        <>
            <div className="section-header" data-spoiler data-nopress>
                <button type="button" onClick={() => setOpen((current) => !current)}>
                    <span style={{ width: 14, textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
                    <span>Steps{typeof steps.length === 'number' ? ` (${steps.length})` : ''}</span>
                </button>
                <span className="spacer" />
                <div className="section-header-right steps-toolbar">
                    <span className="muted">View:</span>
                    <button type="button" onClick={() => setGlobalPreview((current) => !current)} className="btn-small">
                        {globalPreview ? 'Raw' : 'Preview'}
                    </button>
                    <button type="button" onClick={() => addStepAfter(Math.max(steps.length - 1, -1))} className="btn-small">
                        + Add step
                    </button>
                    {onApply && (
                        <button type="button" onClick={onApply} className="btn-small">
                            Apply
                        </button>
                    )}
                </div>
            </div>

            {open && (
                <div className="steps">
                    {steps.length === 0 ? (
                        <div className="steps-empty">
                            <div className="steps-empty-title">No steps yet</div>
                            <div className="steps-empty-text">
                                Add the first step and start composing action, data and expected result.
                            </div>
                            <button type="button" className="btn-small" onClick={() => addStepAfter(-1)}>
                                + Add first step
                            </button>
                        </div>
                    ) : (
                        steps.map((step, index) => (
                            <StepRow
                                key={step.id}
                                ref={(element) => {
                                    stepRefs.current[step.id] = element
                                }}
                                owner={owner}
                                index={index}
                                step={step}
                                preview={globalPreview}
                                isNarrow={isNarrow}
                                allTests={allTests}
                                sharedSteps={sharedSteps}
                                sharedById={sharedById}
                                resolveRefs={resolveRefs}
                                inspectRefs={inspectRefs}
                                onOpenRef={onOpenRef}
                                onActivateEditorApi={onActivateEditorApi}
                                onClone={() => cloneStep(index)}
                                onAddNext={() => addStepAfter(index)}
                                onRemove={() => removeStep(index)}
                                onEditTop={(patch) => updateStep(index, patch)}
                                onAddPart={addPart}
                                onEditPart={editPart}
                                onRemovePart={removePart}
                                onHandleDragStart={(e) => onHandleDragStart(index, e)}
                                onHandleDragEnd={onHandleDragEnd}
                                onCardDragOver={onCardDragOver}
                                onCardDragEnter={() => onCardDragEnter(index)}
                                onCardDragLeave={() => onCardDragLeave(index)}
                                onCardDrop={() => onCardDrop(index)}
                                isDragging={draggingIndex === index}
                                isDropTarget={hoverIndex === index}
                                getStepAttachments={() => (Array.isArray(step.attachments) ? step.attachments : [])}
                                setStepAttachments={(nextAttachments) => updateStep(index, { attachments: nextAttachments })}
                                onUploadStepFiles={onUploadStepFiles}
                                onCreateSharedFromStep={onCreateSharedFromStep}
                                onOpenShared={onOpenShared}
                                onInsertText={onInsertText}
                            />
                        ))
                    )}
                </div>
            )}
        </>
    )
}

const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(function StepRow(props, ref) {
    const { owner, index, step, preview, isNarrow, sharedById } = props

    if (step.usesShared) {
        const shared = sharedById.get(step.usesShared)
        const previewLines = shared?.steps.slice(0, 3).map((item, itemIndex) => ({
            id: item.id,
            text: item.action || item.text || `Step ${itemIndex + 1}`,
        })) ?? []

        return (
            <div
                ref={ref}
                className={`step-card shared-ref-card${props.isDragging ? ' dragging' : ''}${props.isDropTarget ? ' drop-target' : ''}`}
                onDragOver={props.onCardDragOver}
                onDragEnter={props.onCardDragEnter}
                onDragLeave={props.onCardDragLeave}
                onDrop={props.onCardDrop}
            >
                <div className="step-header">
                    <div
                        className="drag"
                        title="Drag to reorder"
                        draggable
                        onDragStart={props.onHandleDragStart}
                        onDragEnd={props.onHandleDragEnd}
                    >
                        ≡
                    </div>
                    <div className="step-title-wrap">
                        <div className="step-title">{shared ? `Shared: ${shared.name}` : 'Missing shared step'}</div>
                        <div className="step-meta">
                            {shared ? <span className="step-chip">{shared.steps.length} steps</span> : <span className="step-chip step-chip-broken">Broken link</span>}
                            <span className="step-chip">Step {index + 1}</span>
                        </div>
                    </div>
                    <span className="spacer" />
                    {shared && props.onOpenShared && (
                        <button type="button" className="btn-small" onClick={() => props.onOpenShared?.(shared.id)}>
                            Open shared
                        </button>
                    )}
                    <button type="button" title="Clone step" onClick={props.onClone} className="btn-small">Clone</button>
                    <button type="button" title="Add next step" onClick={props.onAddNext} className="btn-small">Next</button>
                    <button type="button" title="Remove step" onClick={props.onRemove} className="btn-small">Remove</button>
                </div>

                <div className="shared-ref-body">
                    {shared ? (
                        <>
                            <div className="shared-ref-copy">This step expands from the shared library on export and sync.</div>
                            <div className="shared-ref-preview">
                                {previewLines.map((line) => (
                                    <button
                                        key={line.id}
                                        type="button"
                                        className="shared-ref-preview-item"
                                        onClick={() => props.onOpenShared?.(shared.id, line.id)}
                                    >
                                        {line.text}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="shared-ref-copy broken">The referenced shared step no longer exists in the library.</div>
                    )}
                </div>
            </div>
        )
    }

    const attachments = props.getStepAttachments()
    const partCount =
        (step.internal?.parts?.action?.length ?? 0) +
        (step.internal?.parts?.data?.length ?? 0) +
        (step.internal?.parts?.expected?.length ?? 0)

    const insertLink = (kind: 'action' | 'data' | 'expected', partId?: string) => {
        const refText = `[[${makeStepRef(owner.type, owner.id, step.id, kind, partId)}]]`
        void props.onInsertText?.(refText)
    }

    const PartAddButton = ({ kind }: { kind: 'action' | 'data' | 'expected' }) => (
        <div className="cell-actions">
            {props.onInsertText && (
                <button type="button" className="btn-icon" title={`Insert ${kind} link`} onClick={() => insertLink(kind)}>
                    Link
                </button>
            )}
            <button type="button" title={`Add ${kind} part`} onClick={() => props.onAddPart(index, kind)} className="add-part-btn">
                Add part
            </button>
        </div>
    )

    const renderCell = (kind: 'action' | 'data' | 'expected', label: string) => {
        const topValue = (step as any)[kind] ?? ''
        const parts = step.internal?.parts?.[kind] ?? []
        const setTop = (nextValue: string) => props.onEditTop({ [kind]: nextValue, ...(kind === 'action' ? { text: nextValue } : {}) })

        return (
            <div className="step-cell">
                <div className="cell-head">
                    <div className="cell-head-main">
                        <div className="cell-title">{label}</div>
                        {parts.length > 0 && <span className="cell-chip">{parts.length} parts</span>}
                    </div>
                    <PartAddButton kind={kind} />
                </div>

                <MarkdownEditor
                    value={topValue}
                    onChange={setTop}
                    placeholder={`${label}...`}
                    preview={preview}
                    resolveRefs={props.resolveRefs}
                    inspectRefs={props.inspectRefs}
                    onOpenRef={props.onOpenRef}
                    allTests={props.allTests}
                    sharedSteps={props.sharedSteps}
                    onActivateApi={props.onActivateEditorApi}
                />

                {parts.length > 0 && (
                    <div className="parts">
                        {parts.map((part, partIndex) => (
                            <PartItemRow
                                key={part.id}
                                label={`${label} part ${partIndex + 1}`}
                                value={part.text}
                                preview={preview}
                                allTests={props.allTests}
                                sharedSteps={props.sharedSteps}
                                resolveRefs={props.resolveRefs}
                                inspectRefs={props.inspectRefs}
                                onOpenRef={props.onOpenRef}
                                onActivateApi={props.onActivateEditorApi}
                                onChange={(nextValue) => props.onEditPart(index, kind, partIndex, { text: nextValue })}
                                onRemove={() => props.onRemovePart(index, kind, partIndex)}
                                onInsertLink={props.onInsertText ? () => insertLink(kind, part.id) : undefined}
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
            className={`step-card${props.isDragging ? ' dragging' : ''}${props.isDropTarget ? ' drop-target' : ''}`}
            onDragOver={props.onCardDragOver}
            onDragEnter={props.onCardDragEnter}
            onDragLeave={props.onCardDragLeave}
            onDrop={props.onCardDrop}
        >
            <div className="step-header">
                <div
                    className="drag"
                    title="Drag to reorder"
                    draggable
                    onDragStart={props.onHandleDragStart}
                    onDragEnd={props.onHandleDragEnd}
                >
                    ≡
                </div>
                <div className="step-title-wrap">
                    <div className="step-title">Step {index + 1}</div>
                    <div className="step-meta">
                        {partCount > 0 && <span className="step-chip">{partCount} parts</span>}
                        {attachments.length > 0 && <span className="step-chip">{attachments.length} files</span>}
                        {preview && <span className="step-chip step-chip-preview">Preview</span>}
                    </div>
                </div>
                <span className="spacer" />
                {owner.type === 'test' && props.onCreateSharedFromStep && (
                    <button type="button" className="btn-small" onClick={() => props.onCreateSharedFromStep?.(step)}>
                        Save as shared
                    </button>
                )}
                <button type="button" title="Clone step" onClick={props.onClone} className="btn-small">Clone</button>
                <button type="button" title="Add next step" onClick={props.onAddNext} className="btn-small">Next</button>
                <button type="button" title="Remove step" onClick={props.onRemove} className="btn-small">Remove</button>
            </div>

            <div className={`step-grid ${isNarrow ? 'stack' : ''}`}>
                {!isNarrow && (
                    <div className="step-num">
                        <div className="step-num-badge">{index + 1}</div>
                    </div>
                )}
                <div>{renderCell('action', 'Action')}</div>
                <div>{renderCell('data', 'Data')}</div>
                <div>{renderCell('expected', 'Expected result')}</div>
            </div>

            <div className="step-footer" style={{ padding: isNarrow ? 10 : '10px 10px 12px' }}>
                <StepAttachmentsPanel
                    stepId={step.id}
                    attachments={attachments}
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
    label,
    value,
    preview,
    allTests,
    sharedSteps,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateApi,
    onChange,
    onRemove,
    onInsertLink,
}: {
    label: string
    value: string
    preview: boolean
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateApi?: (api: MarkdownEditorApi | null) => void
    onChange(v: string): void
    onRemove(): void
    onInsertLink?: () => void
}) {
    return (
        <div className="part-row">
            <div className="part-row-toolbar">
                {onInsertLink && (
                    <button type="button" className="btn-icon" title="Insert link to this part" onClick={onInsertLink}>
                        Link
                    </button>
                )}
                <button type="button" className="btn-icon" title="Remove part" onClick={onRemove}>
                    x
                </button>
            </div>
            <MarkdownEditor
                value={value}
                onChange={onChange}
                placeholder={label}
                rows={2}
                preview={preview}
                resolveRefs={resolveRefs}
                inspectRefs={inspectRefs}
                onOpenRef={onOpenRef}
                allTests={allTests}
                sharedSteps={sharedSteps}
                onActivateApi={onActivateApi}
            />
        </div>
    )
}
