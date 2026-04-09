import * as React from 'react'
import { beautifyZephyrJsonBlocksInStep, inspectZephyrJsonBeautifyStep } from '@core/zephyrHtmlParts'
import { buildReferenceStepsFromTest, canReferenceTestStep } from '@core/referenceSteps'
import { StepRow } from './StepRow'
import { InsertStepsFromTestModal } from './InsertStepsFromTestModal'
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
    const [insertFromTestOpen, setInsertFromTestOpen] = React.useState(false)
    const sharedById = React.useMemo(() => new Map(sharedSteps.map((item) => [item.id, item] as const)), [sharedSteps])
    const sourceTests = React.useMemo(
        () => owner.type === 'test'
            ? allTests.filter((test) => test.id !== owner.id && test.steps.some(canReferenceTestStep))
            : [],
        [allTests, owner.id, owner.type]
    )

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

    const handleInsertFromTest = React.useCallback((sourceTestId: string, stepIds: string[]) => {
        const source = allTests.find((test) => test.id === sourceTestId)
        if (!source) return

        const inserted = buildReferenceStepsFromTest(source, stepIds)
        if (!inserted.length) return

        onChange([...steps, ...inserted])
        setOpen(true)
        setInsertFromTestOpen(false)
    }, [allTests, onChange, steps])

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
                    {owner.type === 'test' && (
                        <button
                            type="button"
                            onClick={() => setInsertFromTestOpen(true)}
                            className="btn-small"
                            disabled={sourceTests.length === 0}
                            title={sourceTests.length === 0 ? t('steps.insertFromTestNoTests') : t('steps.addFromTest')}
                        >
                            {t('steps.addFromTest')}
                        </button>
                    )}
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
                            {owner.type === 'test' && (
                                <button
                                    type="button"
                                    className="btn-small"
                                    onClick={() => setInsertFromTestOpen(true)}
                                    disabled={sourceTests.length === 0}
                                >
                                    {t('steps.addFromTest')}
                                </button>
                            )}
                        </div>
                    ) : (
                        steps.map((step, index) => {
                            const beautifiedStep = beautifyZephyrJsonBlocksInStep(step, { tolerant: jsonBeautifyTolerant })
                            const beautifyDiagnostics = inspectZephyrJsonBeautifyStep(step, { tolerant: jsonBeautifyTolerant })
                            const handleBeautifyJson = () => {
                                if (beautifiedStep !== step) {
                                    updateStep(index, beautifiedStep)
                                    return
                                }

                                if (beautifyDiagnostics.failures.length) {
                                    console.warn('[Testcase Studio] JSON beautify failed', {
                                        stepId: step.id,
                                        stepIndex: index + 1,
                                        tolerant: jsonBeautifyTolerant,
                                        failures: beautifyDiagnostics.failures,
                                    })
                                    return
                                }

                                console.info('[Testcase Studio] JSON beautify skipped: no JSON-like blocks found', {
                                    stepId: step.id,
                                    stepIndex: index + 1,
                                    tolerant: jsonBeautifyTolerant,
                                    candidateCount: beautifyDiagnostics.candidateCount,
                                })
                            }

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
                                    canBeautifyJson={beautifiedStep !== step || beautifyDiagnostics.candidateCount > 0}
                                    onBeautifyJson={handleBeautifyJson}
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

            {owner.type === 'test' && (
                <InsertStepsFromTestModal
                    open={insertFromTestOpen}
                    ownerTestId={owner.id}
                    allTests={allTests}
                    resolveRefs={resolveRefs}
                    onClose={() => setInsertFromTestOpen(false)}
                    onApply={handleInsertFromTest}
                />
            )}
        </>
    )
}
