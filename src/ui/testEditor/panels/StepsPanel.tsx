import * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'
import { makeStepRef } from '@core/refs'
import type { Attachment, PartItem, SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import StepAttachmentsPanel from './StepAttachmentsPanel'
import { useUiPreferences } from '../../preferences'

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
    previewMode?: 'raw' | 'preview'
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

type OverflowAction = {
    label: string
    onClick(): void
    danger?: boolean
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
    previewMode,
    onApply,
    onUploadStepFiles,
    onActivateEditorApi,
    onCreateSharedFromStep,
    onOpenShared,
    onInsertText,
}: Props) {
    const { t } = useUiPreferences()
    const [open, setOpen] = React.useState(true)
    const [globalPreview, setGlobalPreview] = React.useState(false)
    const [isNarrow, setIsNarrow] = React.useState(false)
    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const dragIndex = React.useRef<number | null>(null)
    const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
    const sharedById = React.useMemo(() => new Map(sharedSteps.map((item) => [item.id, item] as const)), [sharedSteps])
    const previewEnabled = previewMode ? previewMode === 'preview' : globalPreview

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
            element.style.outline = '2px solid var(--accent-border)'
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
                    <span>{t('steps.title')}{typeof steps.length === 'number' ? ` (${steps.length})` : ''}</span>
                </button>
                <span className="spacer" />
                <div className="section-header-right steps-toolbar">
                    {previewMode == null ? (
                        <>
                            <span className="muted">{t('steps.view')}</span>
                            <button type="button" onClick={() => setGlobalPreview((current) => !current)} className="btn-small">
                                {globalPreview ? t('details.raw') : t('details.preview')}
                            </button>
                        </>
                    ) : (
                        <span className="muted">{previewEnabled ? t('steps.previewAll') : t('steps.rawAll')}</span>
                    )}
                    <button type="button" onClick={() => addStepAfter(Math.max(steps.length - 1, -1))} className="btn-small">
                        {t('steps.add')}
                    </button>
                    {onApply && (
                        <button type="button" onClick={onApply} className="btn-small">
                            {t('steps.apply')}
                        </button>
                    )}
                </div>
            </div>

            {open && (
                <div className="steps">
                    {steps.length === 0 ? (
                        <div className="steps-empty">
                            <div className="steps-empty-title">{t('steps.emptyTitle')}</div>
                            <div className="steps-empty-text">{t('steps.emptyText')}</div>
                            <button type="button" className="btn-small" onClick={() => addStepAfter(-1)}>
                                {t('steps.addFirst')}
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
                                preview={previewEnabled}
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
    const { t } = useUiPreferences()
    const { owner, index, step, preview, isNarrow, sharedById } = props

    const getTopFieldValue = (kind: 'action' | 'data' | 'expected') =>
        String(kind === 'action' ? step.action ?? step.text ?? '' : (step as any)[kind] ?? '').trim()

    const countBlocksForKind = (kind: 'action' | 'data' | 'expected') => {
        const parts = step.internal?.parts?.[kind] ?? []
        if (!parts.length) return 0
        return parts.length + (getTopFieldValue(kind) ? 1 : 0)
    }

    const normalActions: OverflowAction[] = [
        ...(owner.type === 'test' && props.onCreateSharedFromStep
            ? [{ label: t('steps.saveAsShared'), onClick: () => void props.onCreateSharedFromStep?.(step) }]
            : []),
        { label: t('steps.clone'), onClick: props.onClone },
        { label: t('steps.addBelow'), onClick: props.onAddNext },
    ]

    if (step.usesShared) {
        const shared = sharedById.get(step.usesShared)
        const previewLines = shared?.steps.slice(0, 3).map((item, itemIndex) => ({
            id: item.id,
            text: item.action || item.text || t('steps.stepNumber', { index: itemIndex + 1 }),
        })) ?? []
        const sharedActions: OverflowAction[] = [
            ...(shared && props.onOpenShared
                ? [{ label: t('steps.openShared'), onClick: () => props.onOpenShared?.(shared.id) }]
                : []),
            { label: t('steps.clone'), onClick: props.onClone },
            { label: t('steps.addBelow'), onClick: props.onAddNext },
        ]

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
                        title={t('steps.dragToReorder')}
                        draggable
                        onDragStart={props.onHandleDragStart}
                        onDragEnd={props.onHandleDragEnd}
                    >
                        ≡
                    </div>
                    <div className="step-title-wrap">
                        <div className="step-title">{shared ? t('steps.sharedTitle', { name: shared.name }) : t('steps.sharedMissing')}</div>
                        <div className="step-meta">
                            {shared ? <span className="step-chip">{t('steps.sharedStepsCount', { count: shared.steps.length })}</span> : <span className="step-chip step-chip-broken">{t('steps.brokenLink')}</span>}
                            <span className="step-chip">{t('steps.stepNumber', { index: index + 1 })}</span>
                        </div>
                    </div>
                    <span className="spacer" />
                    <div className="step-header-actions">
                        <button
                            type="button"
                            className="btn-icon step-remove-btn"
                            title={t('steps.remove')}
                            onClick={props.onRemove}
                        >
                            x
                        </button>
                        <StepOverflowMenu actions={sharedActions} />
                    </div>
                </div>

                <div className="shared-ref-body">
                    {shared ? (
                        <>
                            <div className="shared-ref-copy">{t('steps.sharedExportHint')}</div>
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
                        <div className="shared-ref-copy broken">{t('steps.sharedMissingHint')}</div>
                    )}
                </div>
            </div>
        )
    }

    const attachments = props.getStepAttachments()
    const blockCount =
        countBlocksForKind('action') +
        countBlocksForKind('data') +
        countBlocksForKind('expected')

    const insertLink = (kind: 'action' | 'data' | 'expected', partId?: string) => {
        const refText = `[[${makeStepRef(owner.type, owner.id, step.id, kind, partId)}]]`
        void props.onInsertText?.(refText)
    }

    const BlockAddButton = ({ kind }: { kind: 'action' | 'data' | 'expected' }) => (
        <div className="cell-actions">
            {props.onInsertText && (
                <button type="button" className="btn-icon" title={t('steps.insertLink', { kind: t(`steps.${kind}`) })} onClick={() => insertLink(kind)}>
                    {t('steps.sharedRef')}
                </button>
            )}
            <button type="button" title={t('steps.addBlock')} onClick={() => props.onAddPart(index, kind)} className="add-part-btn">
                {t('steps.addBlock')}
            </button>
        </div>
    )

    const renderCell = (kind: 'action' | 'data' | 'expected', label: string) => {
        const topValue = (step as any)[kind] ?? ''
        const parts = step.internal?.parts?.[kind] ?? []
        const blockCount = parts.length + (String(topValue ?? '').trim() ? 1 : 0)
        const setTop = (nextValue: string) => props.onEditTop({ [kind]: nextValue, ...(kind === 'action' ? { text: nextValue } : {}) })

        return (
            <div className={`step-cell step-cell--${kind}`}>
                <div className="cell-head">
                    <div className="cell-head-main">
                        <div className="cell-title">{label}</div>
                        {parts.length > 0 && <span className="cell-chip">{t('steps.blocks', { count: blockCount })}</span>}
                    </div>
                    <BlockAddButton kind={kind} />
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
                                label={`${label} ${t('steps.addBlock').toLowerCase()} ${partIndex + 1}`}
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
                    title={t('steps.dragToReorder')}
                    draggable
                    onDragStart={props.onHandleDragStart}
                    onDragEnd={props.onHandleDragEnd}
                >
                    ≡
                </div>
                <div className="step-title-wrap">
                    <div className="step-title">{t('steps.stepNumber', { index: index + 1 })}</div>
                    <div className="step-meta">
                        {blockCount > 0 && <span className="step-chip">{t('steps.blocks', { count: blockCount })}</span>}
                        {attachments.length > 0 && <span className="step-chip">{t('steps.files', { count: attachments.length })}</span>}
                        {preview && <span className="step-chip step-chip-preview">{t('details.preview')}</span>}
                    </div>
                </div>
                <span className="spacer" />
                <div className="step-header-actions">
                    <button
                        type="button"
                        className="btn-icon step-remove-btn"
                        title={t('steps.remove')}
                        onClick={props.onRemove}
                    >
                        x
                    </button>
                    <StepOverflowMenu actions={normalActions} />
                </div>
            </div>

            <div className={`step-grid ${isNarrow ? 'stack' : ''}`}>
                {!isNarrow && (
                    <div className="step-num">
                        <div className="step-num-badge">{index + 1}</div>
                    </div>
                )}
                <div>{renderCell('action', t('steps.action'))}</div>
                <div>{renderCell('data', t('steps.data'))}</div>
                <div>{renderCell('expected', t('steps.expected'))}</div>
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
    const { t } = useUiPreferences()
    return (
        <div className="part-row">
            <div className="part-row-toolbar">
                {onInsertLink && (
                    <button type="button" className="btn-icon" title={t('steps.sharedRef')} onClick={onInsertLink}>
                        {t('steps.sharedRef')}
                    </button>
                )}
                <button type="button" className="btn-icon" title={t('steps.remove')} onClick={onRemove}>
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

function StepOverflowMenu({ actions }: { actions: OverflowAction[] }) {
    const { t } = useUiPreferences()
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        if (!open) return

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null
            if (target && containerRef.current?.contains(target)) return
            setOpen(false)
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }

        document.addEventListener('mousedown', onPointerDown)
        window.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <div className="step-overflow" ref={containerRef}>
            <button
                type="button"
                className="btn-small step-overflow-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                {t('steps.more')}
            </button>
            {open && (
                <div className="step-overflow-menu" role="menu" aria-label={t('steps.more')}>
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            role="menuitem"
                            className={`step-overflow-item${action.danger ? ' danger' : ''}`}
                            onClick={() => {
                                setOpen(false)
                                action.onClick()
                            }}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
