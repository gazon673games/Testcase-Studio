import * as React from 'react'
import type { ResolvedWikiRef, SharedUsage } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../../markdownEditor/MarkdownEditor'
import { useUiPreferences } from '../../../preferences'
import StepsPanel from '../steps/StepsPanel'
import type { SharedListEntry } from './sharedLibraryDerived'
import { SharedLibraryUsageCard } from './SharedLibraryUsageCard'

type Props = {
    selectedEntry: SharedListEntry
    usages: SharedUsage[]
    sharedSteps: SharedStep[]
    allTests: TestCase[]
    focusStepId?: string | null
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onUpdateShared(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void | Promise<void>
    onDeleteShared(sharedId: string): void | Promise<void>
    onInsertShared(sharedId: string): void | Promise<void>
    onOpenUsage(usage: SharedUsage): void
    onOpenShared(sharedId: string, stepId?: string): void
    onInsertText?: (text: string) => void | Promise<void>
}

export function SharedLibraryDetails({
    selectedEntry,
    usages,
    sharedSteps,
    allTests,
    focusStepId,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateEditorApi,
    onUpdateShared,
    onDeleteShared,
    onInsertShared,
    onOpenUsage,
    onOpenShared,
    onInsertText,
}: Props) {
    const { t } = useUiPreferences()

    return (
        <>
            <div className="shared-library-toolbar">
                <div className="field field--flush field--grow">
                    <label className="label-sm">{t('shared.name')}</label>
                    <input
                        className="input"
                        value={selectedEntry.shared.name}
                        onChange={(event) => onUpdateShared(selectedEntry.shared.id, { name: event.target.value })}
                        placeholder={t('shared.namePlaceholder')}
                    />
                </div>
                <div className="shared-library-actions">
                    <button type="button" className="btn-small" onClick={() => onInsertShared(selectedEntry.shared.id)}>
                        {t('shared.insertIntoCase')}
                    </button>
                    <button type="button" className="btn-small" onClick={() => onDeleteShared(selectedEntry.shared.id)}>
                        {t('shared.delete')}
                    </button>
                </div>
            </div>

            <div className="shared-library-summary">
                <span className="shared-library-summary-chip">{t('shared.stepsCount', { count: selectedEntry.shared.steps.length })}</span>
                <span className="shared-library-summary-chip">{t('shared.usagesCount', { count: selectedEntry.usageCount })}</span>
                {selectedEntry.brokenRefCount > 0 ? (
                    <span className="shared-library-summary-chip warning">{t('shared.brokenRefs', { count: selectedEntry.brokenRefCount })}</span>
                ) : (
                    <span className="shared-library-summary-chip ok">{t('shared.noBrokenRefs')}</span>
                )}
            </div>

            <SharedLibraryUsageCard usages={usages} onOpenUsage={onOpenUsage} />

            <StepsPanel
                owner={{ type: 'shared', id: selectedEntry.shared.id }}
                steps={selectedEntry.shared.steps}
                onChange={(next) => onUpdateShared(selectedEntry.shared.id, { steps: next })}
                allTests={allTests}
                sharedSteps={sharedSteps}
                resolveRefs={resolveRefs}
                inspectRefs={inspectRefs}
                onOpenRef={onOpenRef}
                focusStepId={focusStepId}
                onActivateEditorApi={onActivateEditorApi}
                onOpenShared={onOpenShared}
                onInsertText={onInsertText}
            />
        </>
    )
}
