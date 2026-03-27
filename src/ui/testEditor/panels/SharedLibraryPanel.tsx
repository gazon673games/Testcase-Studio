import * as React from 'react'
import { collectSharedUsages, type ResolvedWikiRef, type SharedUsage } from '@core/refs'
import type { SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import StepsPanel from './StepsPanel'

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

type SharedFilter = 'all' | 'used' | 'unused' | 'broken'
type SharedSort = 'usage' | 'name' | 'broken'

type SharedListEntry = {
    shared: SharedStep
    usageCount: number
    usages: SharedUsage[]
    brokenRefCount: number
    searchableText: string
    preview: string
}

const FILTER_LABELS: Record<SharedFilter, string> = {
    all: 'All',
    used: 'In use',
    unused: 'Unused',
    broken: 'Broken refs',
}

const SORT_LABELS: Array<{ value: SharedSort; label: string }> = [
    { value: 'usage', label: 'Most used' },
    { value: 'name', label: 'Name' },
    { value: 'broken', label: 'Broken refs' },
]

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
    const [query, setQuery] = React.useState('')
    const [filter, setFilter] = React.useState<SharedFilter>('all')
    const [sort, setSort] = React.useState<SharedSort>('usage')

    const entries = React.useMemo<SharedListEntry[]>(
        () =>
            sharedSteps.map((shared) => {
                const usages = collectSharedUsages(shared, allTests, sharedSteps)
                const preview = makeSharedPreview(shared.steps)
                return {
                    shared,
                    usages,
                    usageCount: usages.length,
                    brokenRefCount: countBrokenRefs(shared.steps, inspectRefs),
                    searchableText: `${shared.name}\n${flattenStepText(shared.steps)}`.toLowerCase(),
                    preview,
                }
            }),
        [allTests, inspectRefs, sharedSteps]
    )

    const selectedEntry = React.useMemo(
        () => entries.find((entry) => entry.shared.id === selectedSharedId) ?? entries[0] ?? null,
        [entries, selectedSharedId]
    )
    const usages = selectedEntry?.usages ?? []

    const filterCounts = React.useMemo(
        () => ({
            all: entries.length,
            used: entries.filter((entry) => entry.usageCount > 0).length,
            unused: entries.filter((entry) => entry.usageCount === 0).length,
            broken: entries.filter((entry) => entry.brokenRefCount > 0).length,
        }),
        [entries]
    )

    const filteredEntries = React.useMemo(() => {
        const trimmedQuery = query.trim().toLowerCase()
        const next = entries.filter((entry) => {
            if (filter === 'used' && entry.usageCount === 0) return false
            if (filter === 'unused' && entry.usageCount > 0) return false
            if (filter === 'broken' && entry.brokenRefCount === 0) return false
            if (!trimmedQuery) return true
            return entry.searchableText.includes(trimmedQuery)
        })

        next.sort((left, right) => {
            if (sort === 'name') return left.shared.name.localeCompare(right.shared.name)
            if (sort === 'broken') {
                return (
                    right.brokenRefCount - left.brokenRefCount ||
                    right.usageCount - left.usageCount ||
                    left.shared.name.localeCompare(right.shared.name)
                )
            }
            return (
                right.usageCount - left.usageCount ||
                right.brokenRefCount - left.brokenRefCount ||
                left.shared.name.localeCompare(right.shared.name)
            )
        })

        return next
    }, [entries, filter, query, sort])

    React.useEffect(() => {
        if (!selectedEntry && entries[0]) onSelectShared(entries[0].shared.id)
    }, [entries, onSelectShared, selectedEntry])

    React.useEffect(() => {
        if (!filteredEntries.length) return
        if (selectedEntry && filteredEntries.some((entry) => entry.shared.id === selectedEntry.shared.id)) return
        onSelectShared(filteredEntries[0].shared.id)
    }, [filteredEntries, onSelectShared, selectedEntry])

    return (
        <div className={`shared-library ${variant === 'drawer' ? 'shared-library--drawer' : ''}`}>
            <div className="shared-library-sidebar">
                <div className="shared-library-head">
                    <div className="shared-library-title">Shared steps</div>
                    <div className="shared-library-head-actions">
                        {extraHeaderAction}
                        <button type="button" className="btn-small" onClick={() => void onAddShared()}>
                            + New shared
                        </button>
                    </div>
                </div>

                <div className="shared-library-stats">
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.all}</span>
                        <span className="shared-library-stat-label">total</span>
                    </div>
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.used}</span>
                        <span className="shared-library-stat-label">in use</span>
                    </div>
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.broken}</span>
                        <span className="shared-library-stat-label">broken</span>
                    </div>
                </div>

                <div className="shared-library-controls">
                    <div className="field" style={{ margin: 0 }}>
                        <label className="label-sm">Search library</label>
                        <input
                            className="input"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Name or step text"
                        />
                    </div>

                    <div className="shared-library-filter-row">
                        {(Object.keys(FILTER_LABELS) as SharedFilter[]).map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={`shared-library-filter ${filter === value ? 'active' : ''}`}
                                onClick={() => setFilter(value)}
                            >
                                {FILTER_LABELS[value]} ({filterCounts[value]})
                            </button>
                        ))}
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                        <label className="label-sm">Sort</label>
                        <select
                            className="input"
                            value={sort}
                            onChange={(event) => setSort(event.target.value as SharedSort)}
                        >
                            {SORT_LABELS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {sharedSteps.length === 0 ? (
                    <div className="shared-library-empty">The library is empty. Create the first shared step and reuse it across cases.</div>
                ) : filteredEntries.length === 0 ? (
                    <div className="shared-library-empty">
                        No shared steps match the current search and filters.
                    </div>
                ) : (
                    <>
                        <div className="shared-library-result-copy">
                            Showing {filteredEntries.length} of {sharedSteps.length}
                        </div>
                        <div className="shared-library-list">
                            {filteredEntries.map((entry) => (
                                <button
                                    key={entry.shared.id}
                                    type="button"
                                    className={`shared-library-item ${selectedEntry?.shared.id === entry.shared.id ? 'active' : ''}`}
                                    onClick={() => onSelectShared(entry.shared.id)}
                                >
                                    <div className="shared-library-item-title">{entry.shared.name}</div>
                                    <div className="shared-library-item-meta">
                                        <span>{entry.shared.steps.length} steps</span>
                                        <span>{entry.usageCount} usages</span>
                                        {entry.brokenRefCount > 0 && <span>{entry.brokenRefCount} broken</span>}
                                    </div>
                                    {entry.preview ? <div className="shared-library-item-preview">{entry.preview}</div> : null}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="shared-library-main">
                {!selectedEntry ? (
                    <div className="shared-library-empty main">Select a shared step to edit it.</div>
                ) : (
                    <>
                        <div className="shared-library-toolbar">
                            <div className="field" style={{ margin: 0, flex: 1 }}>
                                <label className="label-sm">Shared step name</label>
                                <input
                                    className="input"
                                    value={selectedEntry.shared.name}
                                    onChange={(e) => onUpdateShared(selectedEntry.shared.id, { name: e.target.value })}
                                    placeholder="Shared step name"
                                />
                            </div>
                            <div className="shared-library-actions">
                                <button type="button" className="btn-small" onClick={() => onInsertShared(selectedEntry.shared.id)}>
                                    Insert into case
                                </button>
                                <button type="button" className="btn-small" onClick={() => onDeleteShared(selectedEntry.shared.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div className="shared-library-summary">
                            <span className="shared-library-summary-chip">{selectedEntry.shared.steps.length} steps</span>
                            <span className="shared-library-summary-chip">{selectedEntry.usageCount} usages</span>
                            {selectedEntry.brokenRefCount > 0 ? (
                                <span className="shared-library-summary-chip warning">{selectedEntry.brokenRefCount} broken refs</span>
                            ) : (
                                <span className="shared-library-summary-chip ok">No broken refs</span>
                            )}
                        </div>

                        <div className="shared-library-usage-card">
                            <div className="shared-library-usage-title">Usages and backlinks</div>
                            {usages.length === 0 ? (
                                <div className="shared-library-usage-empty">This shared step is not used anywhere yet.</div>
                            ) : (
                                <div className="shared-library-usage-list">
                                    {usages.map((usage) => (
                                        <button
                                            key={usage.id}
                                            type="button"
                                            className="shared-library-usage-item"
                                            onClick={() => onOpenUsage(usage)}
                                        >
                                            <span className="shared-library-usage-kind">{usage.kind === 'usesShared' ? 'Uses shared' : 'Ref'}</span>
                                            <span className="shared-library-usage-name">{usage.ownerName}</span>
                                            <span className="shared-library-usage-source">{usage.sourceLabel}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

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
                )}
            </div>
        </div>
    )
}

function flattenStepText(steps: Step[]) {
    return collectStepTexts(steps).join(' \n ')
}

function countBrokenRefs(steps: Step[], inspectRefs: (src: string) => ResolvedWikiRef[]) {
    let total = 0
    for (const text of collectStepTexts(steps)) {
        if (!text) continue
        total += inspectRefs(text).filter((ref) => !ref.ok).length
    }
    return total
}

function makeSharedPreview(steps: Step[]) {
    return steps
        .slice(0, 2)
        .map((step) => String(step.action || step.text || step.expected || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' • ')
}

function collectStepTexts(steps: Step[]) {
    return steps
        .flatMap((step) => [
            step.action,
            step.data,
            step.expected,
            step.text,
            ...(step.internal?.parts?.action?.map((part) => part.text) ?? []),
            ...(step.internal?.parts?.data?.map((part) => part.text) ?? []),
            ...(step.internal?.parts?.expected?.map((part) => part.text) ?? []),
        ])
        .filter((value): value is string => Boolean(value))
}
