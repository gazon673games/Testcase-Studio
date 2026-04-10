import * as React from 'react'
import type { TestCase } from '@core/domain'
import {
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewField,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
    PreviewToolbar,
    PreviewToolbarGroup,
} from '../../../previewDialog'
import { useUiPreferences } from '../../../preferences'
import { InsertStepsPreviewBlock } from './InsertStepsPreviewBlock'
import { useInsertStepsFromTestSelection } from './useInsertStepsFromTestSelection'
import './InsertStepsFromTestModal.css'

type Props = {
    open: boolean
    ownerTestId: string
    allTests: TestCase[]
    resolveRefs(src: string): string
    onClose(): void
    onApply(testId: string, stepIds: string[]): void
}

export function InsertStepsFromTestModal({ open, ownerTestId, allTests, resolveRefs, onClose, onApply }: Props) {
    const { t } = useUiPreferences()
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const {
        query,
        selectedStepIds,
        availableTests,
        filteredTests,
        selectedTest,
        selectableSteps,
        selectedCount,
        canApply,
        setQuery,
        setSelectedTestId,
        setSelectedStepIds,
    } = useInsertStepsFromTestSelection({
        open,
        ownerTestId,
        allTests,
    })

    if (!open) return null

    return (
        <PreviewDialog
            open={open}
            title={t('steps.insertFromTestTitle')}
            subtitle={t('steps.insertFromTestSubtitle')}
            onClose={onClose}
            initialFocusRef={searchInputRef}
        >
            <PreviewDialogSplit
                sidebar={(
                    <div className="insert-steps-modal">
                        <PreviewField label={t('steps.insertFromTestSearch')}>
                            <input
                                ref={searchInputRef}
                                className="preview-dialog__input"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('steps.insertFromTestSearchPlaceholder')}
                            />
                        </PreviewField>
                        {filteredTests.length === 0 ? (
                            <PreviewCard>
                                <PreviewHint>
                                    {availableTests.length === 0
                                        ? t('steps.insertFromTestNoTests')
                                        : t('steps.insertFromTestNoMatches')}
                                </PreviewHint>
                            </PreviewCard>
                        ) : (
                            <div className="insert-steps-modal__test-list">
                                {filteredTests.map((test) => {
                                    const zephyrId = String(test.links.find((link) => link.provider === 'zephyr')?.externalId ?? '').trim()
                                    return (
                                        <button
                                            key={test.id}
                                            type="button"
                                            className={`insert-steps-modal__test-item${selectedTest?.id === test.id ? ' active' : ''}`}
                                            onClick={() => {
                                                setSelectedTestId(test.id)
                                                setSelectedStepIds([])
                                            }}
                                        >
                                            <div className="insert-steps-modal__test-name">{test.name}</div>
                                            <div className="insert-steps-modal__test-meta">
                                                <span>{t('steps.insertFromTestStepsCount', { count: test.steps.length })}</span>
                                                {zephyrId ? <span>{zephyrId}</span> : null}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
                content={selectedTest ? (
                    <div className="insert-steps-modal">
                        <PreviewCard>
                            <PreviewInfoGrid>
                                <PreviewInfoPair label={t('steps.insertFromTestSource')} value={selectedTest.name} />
                                <PreviewInfoPair label={t('steps.insertFromTestSteps')} value={String(selectableSteps.length)} />
                                <PreviewInfoPair label={t('steps.insertFromTestSelected')} value={String(selectedCount)} />
                            </PreviewInfoGrid>
                        </PreviewCard>

                        {selectableSteps.length === 0 ? (
                            <PreviewCard>
                                <PreviewHint>{t('steps.insertFromTestNoReferenceableSteps')}</PreviewHint>
                            </PreviewCard>
                        ) : (
                            <>
                                <PreviewToolbar>
                                    <PreviewToolbarGroup>
                                        <PreviewHint>{t('steps.insertFromTestChooseHint')}</PreviewHint>
                                    </PreviewToolbarGroup>
                                    <PreviewToolbarGroup align="end">
                                        <PreviewButton
                                            tone="ghost"
                                            onClick={() => setSelectedStepIds(selectableSteps.map((step) => step.id))}
                                        >
                                            {t('steps.insertFromTestSelectAll')}
                                        </PreviewButton>
                                        <PreviewButton tone="ghost" onClick={() => setSelectedStepIds([])}>
                                            {t('steps.insertFromTestClear')}
                                        </PreviewButton>
                                    </PreviewToolbarGroup>
                                </PreviewToolbar>

                                <div className="insert-steps-modal__step-list">
                                    {selectableSteps.map((step, index) => {
                                        const checked = selectedStepIds.includes(step.id)
                                        return (
                                            <label key={step.id} className="insert-steps-modal__step-item">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        setSelectedStepIds((current) => (
                                                            event.target.checked
                                                                ? [...current, step.id]
                                                                : current.filter((value) => value !== step.id)
                                                        ))
                                                    }}
                                                />
                                                <div className="insert-steps-modal__step-copy">
                                                    <div className="insert-steps-modal__step-title">
                                                        {t('steps.stepNumber', { index: index + 1 })}
                                                    </div>
                                                    <div className="insert-steps-modal__step-grid">
                                                        <InsertStepsPreviewBlock
                                                            label={t('steps.action')}
                                                            value={step.action || step.text || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                        <InsertStepsPreviewBlock
                                                            label={t('steps.data')}
                                                            value={step.data || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                        <InsertStepsPreviewBlock
                                                            label={t('steps.expected')}
                                                            value={step.expected || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        <div className="insert-steps-modal__actions">
                            <PreviewButton tone="ghost" onClick={onClose}>
                                {t('includedCases.close')}
                            </PreviewButton>
                            <PreviewButton
                                onClick={() => {
                                    if (!selectedTest) return
                                    onApply(selectedTest.id, selectedStepIds)
                                }}
                                disabled={!canApply}
                            >
                                {t('steps.insertFromTestApply')}
                            </PreviewButton>
                        </div>
                    </div>
                ) : (
                    <div className="insert-steps-modal">
                        <PreviewCard>
                            <PreviewHint>{t('steps.insertFromTestSelectSource')}</PreviewHint>
                        </PreviewCard>
                    </div>
                )}
                className="preview-dialog__split--compact"
            />
        </PreviewDialog>
    )
}
