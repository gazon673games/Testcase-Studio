import * as React from 'react'
import { makeStepRef } from '@core/refs'
import type { Attachment, PartItem, Step } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import StepAttachmentsPanel from './StepAttachmentsPanel'
import type { OverflowAction, StepFieldKind, StepRowProps } from './stepsPanelTypes'
import { useUiPreferences } from '../../preferences'

type PartItemRowProps = {
    label: string
    value: string
    preview: boolean
    allTests: StepRowProps['allTests']
    sharedSteps: StepRowProps['sharedSteps']
    resolveRefs: StepRowProps['resolveRefs']
    inspectRefs: StepRowProps['inspectRefs']
    onOpenRef: StepRowProps['onOpenRef']
    onActivateApi?: (api: MarkdownEditorApi | null) => void
    onChange(value: string): void
    onRemove(): void
    onInsertLink?: () => void
}

type StepCellProps = {
    kind: StepFieldKind
    label: string
    index: number
    step: Step
    preview: boolean
    props: StepRowProps
    onInsertLink(kind: StepFieldKind, partId?: string): void
}

function getStepFieldValue(step: Step, kind: StepFieldKind) {
    switch (kind) {
        case 'action':
            return String(step.action ?? step.text ?? '')
        case 'data':
            return String(step.data ?? '')
        case 'expected':
            return String(step.expected ?? '')
    }
}

function countBlocksForKind(step: Step, kind: StepFieldKind) {
    const parts = step.internal?.parts?.[kind] ?? []
    const topLevelValue = getStepFieldValue(step, kind).trim()
    return parts.length + (topLevelValue ? 1 : 0)
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
}: PartItemRowProps) {
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
                className="md-editor--step"
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

function StepCell({ kind, label, index, step, preview, props, onInsertLink }: StepCellProps) {
    const { t } = useUiPreferences()
    const topValue = getStepFieldValue(step, kind)
    const parts = step.internal?.parts?.[kind] ?? []
    const blockCount = parts.length + (topValue.trim() ? 1 : 0)

    const setTop = (nextValue: string) => props.onEditTop({ [kind]: nextValue, ...(kind === 'action' ? { text: nextValue } : {}) })

    return (
        <div className={`step-cell step-cell--${kind}`}>
            <div className="cell-head">
                <div className="cell-head-main">
                    <div className="cell-title">{label}</div>
                    {parts.length > 0 && <span className="cell-chip">{t('steps.blocks', { count: blockCount })}</span>}
                </div>
                <div className="cell-actions">
                    {props.onInsertText && (
                        <button type="button" className="btn-icon" title={t('steps.insertLink', { kind: t(`steps.${kind}`) })} onClick={() => onInsertLink(kind)}>
                            {t('steps.sharedRef')}
                        </button>
                    )}
                    <button type="button" title={t('steps.addBlock')} onClick={() => props.onAddPart(index, kind)} className="add-part-btn">
                        {t('steps.addBlock')}
                    </button>
                </div>
            </div>

            <MarkdownEditor
                value={topValue}
                onChange={setTop}
                placeholder={`${label}...`}
                preview={preview}
                className="md-editor--step"
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
                            onInsertLink={props.onInsertText ? () => onInsertLink(kind, part.id) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function SharedReferenceStepCard({
    props,
    sharedActions,
    cardRef,
}: {
    props: StepRowProps
    sharedActions: OverflowAction[]
    cardRef?: React.Ref<HTMLDivElement>
}) {
    const { t } = useUiPreferences()
    const { index, step, sharedById } = props
    const shared = sharedById.get(step.usesShared!)
    const previewLines = shared?.steps.slice(0, 3).map((item, itemIndex) => ({
        id: item.id,
        text: item.action || item.text || t('steps.stepNumber', { index: itemIndex + 1 }),
    })) ?? []

    return (
        <div
            ref={cardRef}
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
                    {"\u2261"}
                </div>
                <div className="step-title-wrap">
                    <div className="step-title">{shared ? t('steps.sharedTitle', { name: shared.name }) : t('steps.sharedMissing')}</div>
                    <div className="step-meta">
                        {shared
                            ? <span className="step-chip">{t('steps.sharedStepsCount', { count: shared.steps.length })}</span>
                            : <span className="step-chip step-chip-broken">{t('steps.brokenLink')}</span>}
                        <span className="step-chip">{t('steps.stepNumber', { index: index + 1 })}</span>
                    </div>
                </div>
                <span className="spacer" />
                <div className="step-header-actions">
                    <button type="button" className="btn-icon step-remove-btn" title={t('steps.remove')} onClick={props.onRemove}>
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

function EditableStepCard({
    props,
    normalActions,
    cardRef,
}: {
    props: StepRowProps
    normalActions: OverflowAction[]
    cardRef?: React.Ref<HTMLDivElement>
}) {
    const { t } = useUiPreferences()
    const { owner, index, step, preview, isNarrow } = props
    const attachments = props.getStepAttachments()
    const blockCount =
        countBlocksForKind(step, 'action') +
        countBlocksForKind(step, 'data') +
        countBlocksForKind(step, 'expected')

    const insertLink = (kind: StepFieldKind, partId?: string) => {
        const refText = `[[${makeStepRef(owner.type, owner.id, step.id, kind, partId)}]]`
        void props.onInsertText?.(refText)
    }

    return (
        <div
            ref={cardRef}
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
                    {"\u2261"}
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
                    <button type="button" className="btn-icon step-remove-btn" title={t('steps.remove')} onClick={props.onRemove}>
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
                <div><StepCell kind="action" label={t('steps.action')} index={index} step={step} preview={preview} props={props} onInsertLink={insertLink} /></div>
                <div><StepCell kind="data" label={t('steps.data')} index={index} step={step} preview={preview} props={props} onInsertLink={insertLink} /></div>
                <div><StepCell kind="expected" label={t('steps.expected')} index={index} step={step} preview={preview} props={props} onInsertLink={insertLink} /></div>
            </div>

            <div className={`step-footer ${isNarrow ? 'step-footer--compact' : 'step-footer--regular'}`}>
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
}

export const StepRow = React.forwardRef<HTMLDivElement, StepRowProps>(function StepRow(props, ref) {
    const { t } = useUiPreferences()
    const { owner, step, sharedById } = props

    const normalActions: OverflowAction[] = [
        ...(owner.type === 'test' && props.onCreateSharedFromStep
            ? [{ label: t('steps.saveAsShared'), onClick: () => void props.onCreateSharedFromStep?.(step) }]
            : []),
        { label: t('steps.clone'), onClick: props.onClone },
        { label: t('steps.addBelow'), onClick: props.onAddNext },
    ]

    const sharedActions: OverflowAction[] = step.usesShared
        ? [
            ...(sharedById.get(step.usesShared) && props.onOpenShared
                ? [{ label: t('steps.openShared'), onClick: () => props.onOpenShared?.(step.usesShared!, undefined) }]
                : []),
            { label: t('steps.clone'), onClick: props.onClone },
            { label: t('steps.addBelow'), onClick: props.onAddNext },
        ]
        : []

    return (
        step.usesShared
            ? <SharedReferenceStepCard props={props} sharedActions={sharedActions} cardRef={ref} />
            : <EditableStepCard props={props} normalActions={normalActions} cardRef={ref} />
    )
})
