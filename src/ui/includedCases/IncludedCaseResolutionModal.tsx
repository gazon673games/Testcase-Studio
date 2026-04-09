import * as React from 'react'
import type { IncludedCaseCandidate, IncludedCaseResolution } from '@app/workspace'
import {
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewField,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import './IncludedCaseResolutionModal.css'

type Props = {
    open: boolean
    items: IncludedCaseCandidate[]
    onClose(): void
    onApply(decisions: Record<string, IncludedCaseResolution>): void
}

export function IncludedCaseResolutionModal({ open, items, onClose, onApply }: Props) {
    const { t } = useUiPreferences()
    const [decisions, setDecisions] = React.useState<Partial<Record<string, IncludedCaseResolution>>>({})

    React.useEffect(() => {
        if (!open) return
        setDecisions({})
    }, [items, open])

    const canApply = items.length > 0 && items.every((item) => Boolean(decisions[item.id]))

    if (!open) return null

    return (
        <PreviewDialog
            open={open}
            title={t('includedCases.title')}
            subtitle={t('includedCases.subtitle', { count: items.length })}
            onClose={onClose}
        >
            <div className="included-cases-modal">
                <PreviewHint>{t('includedCases.hint')}</PreviewHint>

                <div className="included-cases-modal__list">
                    {items.map((item) => (
                        <PreviewCard key={item.id}>
                            <div className="included-cases-modal__title">
                                {item.includedTestName
                                    ? t('includedCases.caseNamed', { name: item.includedTestName, key: item.includedTestKey })
                                    : t('includedCases.caseKey', { key: item.includedTestKey })}
                            </div>
                            <PreviewInfoGrid>
                                <PreviewInfoPair
                                    label={t('includedCases.hostCase')}
                                    value={item.hostTestName}
                                />
                                <PreviewInfoPair
                                    label={t('includedCases.hostStep')}
                                    value={`#${item.stepIndex + 1} ${item.stepLabel}`}
                                />
                                <PreviewInfoPair
                                    label={t('includedCases.steps')}
                                    value={String(item.includedStepsCount)}
                                />
                            </PreviewInfoGrid>
                            <PreviewField label={t('includedCases.action')}>
                                <select
                                    className="preview-dialog__select"
                                    value={decisions[item.id] ?? ''}
                                    onChange={(event) => {
                                        const value = event.target.value as IncludedCaseResolution | ''
                                        setDecisions((current) => {
                                            if (!value) {
                                                const next = { ...current }
                                                delete next[item.id]
                                                return next
                                            }
                                            return { ...current, [item.id]: value }
                                        })
                                    }}
                                >
                                    <option value="">{t('includedCases.option.choose')}</option>
                                    <option value="inline">{t('includedCases.option.inline')}</option>
                                    <option value="create-local-case">{t('includedCases.option.createLocal')}</option>
                                </select>
                            </PreviewField>
                        </PreviewCard>
                    ))}
                </div>

                <div className="included-cases-modal__actions">
                    <PreviewButton tone="ghost" onClick={onClose}>
                        {t('includedCases.close')}
                    </PreviewButton>
                    <PreviewButton onClick={() => onApply(decisions as Record<string, IncludedCaseResolution>)} disabled={!canApply}>
                        {t('includedCases.apply')}
                    </PreviewButton>
                </div>
            </div>
        </PreviewDialog>
    )
}
