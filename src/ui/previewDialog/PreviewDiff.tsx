import * as React from 'react'
import type { PreviewStepDiffEntry, PreviewStepDiffRow } from '@core/previewDiff'
import { useUiPreferences } from '../preferences'

type DiffSide = 'local' | 'remote'

export function PreviewDiffCard({
    title,
    leftLabel,
    rightLabel,
    leftText,
    rightText,
    stepRows,
    leftSide = 'local',
    rightSide = 'remote',
}: {
    title: string
    leftLabel: string
    rightLabel: string
    leftText: string
    rightText: string
    stepRows?: PreviewStepDiffRow[]
    leftSide?: DiffSide
    rightSide?: DiffSide
}) {
    const { t } = useUiPreferences()
    return (
        <div className="preview-dialog__diff-card">
            <div className="preview-dialog__diff-title">{title}</div>
            <div className="preview-dialog__diff-columns">
                <div>
                    <div className="preview-dialog__diff-label">{leftLabel}</div>
                    <div className="preview-dialog__diff-text">{leftText}</div>
                </div>
                <div>
                    <div className="preview-dialog__diff-label">{rightLabel}</div>
                    <div className="preview-dialog__diff-text">{rightText}</div>
                </div>
            </div>

            {stepRows?.length ? (
                <div className="preview-dialog__step-list">
                    {stepRows.map((row) => (
                        <div
                            key={`${title}-${row.index}`}
                            className="preview-dialog__step-row"
                            data-changed={row.changed ? 'true' : 'false'}
                        >
                            <div className="preview-dialog__step-index">{t('preview.step', { index: row.index })}</div>
                            <div className="preview-dialog__step-columns">
                                <StepEntryCard
                                    entry={row[leftSide]}
                                    emptyLabel={t('preview.noSideStep', { label: leftLabel.toLowerCase() })}
                                />
                                <StepEntryCard
                                    entry={row[rightSide]}
                                    emptyLabel={t('preview.noSideStep', { label: rightLabel.toLowerCase() })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function StepEntryCard({ entry, emptyLabel }: { entry?: PreviewStepDiffEntry; emptyLabel: string }) {
    if (!entry) {
        return (
            <div className="preview-dialog__step-entry" data-empty="true">
                <div className="preview-dialog__step-summary">{emptyLabel}</div>
            </div>
        )
    }

    return (
        <div className="preview-dialog__step-entry">
            <div className="preview-dialog__step-summary">{entry.summary}</div>
            <StepField label="Action" value={entry.action} />
            <StepField label="Data" value={entry.data} />
            <StepField label="Expected" value={entry.expected} />
        </div>
    )
}

function StepField({ label, value }: { label: string; value: string }) {
    const { t } = useUiPreferences()
    const localizedLabel =
        label === 'Action' ? t('preview.action')
        : label === 'Data' ? t('preview.data')
        : label === 'Expected' ? t('preview.expected')
        : label
    return (
        <div className="preview-dialog__step-field">
            <div className="preview-dialog__step-field-label">{localizedLabel}</div>
            <div className="preview-dialog__step-field-value">{value}</div>
        </div>
    )
}
