import * as React from 'react'
import type { ResolvedWikiRef, SharedUsage } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../../markdownEditor/MarkdownEditor'
import { SharedLibraryDetails } from './SharedLibraryDetails'
import { SharedLibrarySidebar } from './SharedLibrarySidebar'
import { type SharedFilter, type SharedSort, useSharedLibraryDerived } from './sharedLibraryDerived'
import { useSharedLibrarySelectionSync } from './useSharedLibrarySelectionSync'
import { useUiPreferences } from '../../../preferences'

type Props = {
    variant?: 'inline' | 'drawer'
    extraHeaderAction?: React.ReactNode
    sharedSteps: SharedStep[]
    selectedSharedId: string | null
    focusStepId?: string | null
    allTests: TestCase[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onSelectShared(id: string): void
    onAddShared(): void | Promise<void>
    onUpdateShared(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void | Promise<void>
    onDeleteShared(sharedId: string): void | Promise<void>
    onInsertShared(sharedId: string): void | Promise<void>
    onOpenUsage(usage: SharedUsage): void
    onOpenShared(sharedId: string, stepId?: string): void
    onInsertText?: (text: string) => void | Promise<void>
}

export default function SharedLibraryPanel({
    variant = 'inline',
    extraHeaderAction,
    sharedSteps,
    selectedSharedId,
    focusStepId,
    allTests,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateEditorApi,
    onSelectShared,
    onAddShared,
    onUpdateShared,
    onDeleteShared,
    onInsertShared,
    onOpenUsage,
    onOpenShared,
    onInsertText,
}: Props) {
    const { t } = useUiPreferences()
    const [query, setQuery] = React.useState('')
    const [filter, setFilter] = React.useState<SharedFilter>('all')
    const [sort, setSort] = React.useState<SharedSort>('usage')

    const { entries, selectedEntry, usages, filterCounts, filteredEntries } = useSharedLibraryDerived({
        sharedSteps,
        allTests,
        inspectRefs,
        selectedSharedId,
        query,
        filter,
        sort,
    })

    useSharedLibrarySelectionSync({
        entries,
        filteredEntries,
        selectedEntry,
        onSelectShared,
    })

    return (
        <div className={`shared-library ${variant === 'drawer' ? 'shared-library--drawer' : ''}`}>
            <SharedLibrarySidebar
                extraHeaderAction={extraHeaderAction}
                sharedSteps={sharedSteps}
                query={query}
                filter={filter}
                sort={sort}
                filterCounts={filterCounts}
                filteredEntries={filteredEntries}
                selectedEntryId={selectedEntry?.shared.id ?? null}
                onQueryChange={setQuery}
                onFilterChange={setFilter}
                onSortChange={setSort}
                onSelectShared={onSelectShared}
                onAddShared={onAddShared}
            />

            <div className="shared-library-main">
                {!selectedEntry ? (
                    <div className="shared-library-empty main">{t('shared.selectToEdit')}</div>
                ) : (
                    <SharedLibraryDetails
                        selectedEntry={selectedEntry}
                        usages={usages}
                        sharedSteps={sharedSteps}
                        allTests={allTests}
                        focusStepId={focusStepId}
                        resolveRefs={resolveRefs}
                        inspectRefs={inspectRefs}
                        onOpenRef={onOpenRef}
                        onActivateEditorApi={onActivateEditorApi}
                        onUpdateShared={onUpdateShared}
                        onDeleteShared={onDeleteShared}
                        onInsertShared={onInsertShared}
                        onOpenUsage={onOpenUsage}
                        onOpenShared={onOpenShared}
                        onInsertText={onInsertText}
                    />
                )}
            </div>
        </div>
    )
}
