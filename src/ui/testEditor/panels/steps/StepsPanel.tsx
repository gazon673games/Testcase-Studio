import * as React from 'react'
import { beautifyZephyrJsonBlocksInStep } from '@core/zephyrHtmlParts'
import { StepRow } from './StepRow'
import type { StepsPanelProps } from './stepsPanelTypes'
import { useStepsPanelController } from './useStepsPanelController'
import { useUiPreferences } from '../../../preferences'

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
}: StepsPanelProps) {
    const { t, jsonBeautifyTolerant } = useUiPreferences()
    const sharedById = React.useMemo(() => new Map(sharedSteps.map((item) => [item.id, item] as const)), [sharedSteps])

    const {
        open,
        setOpen,
        globalPreview,
        setGlobalPreview,
        isNarrow,
        previewEnabled,
        stepRefs,
        draggingIndex,
        hoverIndex,
        updateStep,
        addStepAfter,
        cloneStep,
        removeStep,
        addPart,
        editPart,
        removePart,
        handleDragStart,
        handleDragEnd,
        handleCardDragOver,
        handleCardDragEnter,
        handleCardDragLeave,
        handleCardDrop,
    } = useStepsPanelController({
        steps,
        onChange,
        focusStepId,
        previewMode,
    })

    return (
        <>
            <div className="section-header" data-spoiler data-nopress>
                <button type="button" onClick={() => setOpen((current) => !current)}>
                    <span style={{ width: 14, textAlign: 'center' }}>{open ? '\u25BE' : '\u25B8'}</span>
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
                        steps.map((step, index) => {
                            const beautifiedStep = beautifyZephyrJsonBlocksInStep(step, { tolerant: jsonBeautifyTolerant })

                            return (
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
                                    canBeautifyJson={beautifiedStep !== step}
                                    onBeautifyJson={() => updateStep(index, beautifiedStep)}
                                    onEditTop={(patch) => updateStep(index, patch)}
                                    onAddPart={addPart}
                                    onEditPart={editPart}
                                    onRemovePart={removePart}
                                    onHandleDragStart={(event) => handleDragStart(index, event)}
                                    onHandleDragEnd={handleDragEnd}
                                    onCardDragOver={handleCardDragOver}
                                    onCardDragEnter={() => handleCardDragEnter(index)}
                                    onCardDragLeave={() => handleCardDragLeave(index)}
                                    onCardDrop={() => handleCardDrop(index)}
                                    isDragging={draggingIndex === index}
                                    isDropTarget={hoverIndex === index}
                                    getStepAttachments={() => (Array.isArray(step.attachments) ? step.attachments : [])}
                                    setStepAttachments={(nextAttachments) => updateStep(index, { attachments: nextAttachments })}
                                    onUploadStepFiles={onUploadStepFiles}
                                    onCreateSharedFromStep={onCreateSharedFromStep}
                                    onOpenShared={onOpenShared}
                                    onInsertText={onInsertText}
                                />
                            )
                        })
                    )}
                </div>
            )}
        </>
    )
}
