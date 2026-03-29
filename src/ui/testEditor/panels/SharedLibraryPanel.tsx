import * as React from 'react'
import { collectSharedUsages, type ResolvedWikiRef, type SharedUsage } from '@core/refs'
import type { SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import StepsPanel from './StepsPanel'
import { useUiPreferences } from '../../preferences'

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
    const filterLabels: Record<SharedFilter, string> = {
        all: t('shared.filter.all'),
        used: t('shared.filter.used'),
        unused: t('shared.filter.unused'),
        broken: t('shared.filter.broken'),
    }
    const sortLabels: Array<{ value: SharedSort; label: string }> = [
        { value: 'usage', label: t('shared.sort.usage') },
        { value: 'name', label: t('shared.sort.name') },
        { value: 'broken', label: t('shared.sort.broken') },
    ]

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
                    <div className="shared-library-title">{t('shared.title')}</div>
                    <div className="shared-library-head-actions">
                        {extraHeaderAction}
                        <button type="button" className="btn-small" onClick={() => void onAddShared()}>
                            {t('shared.new')}
                        </button>
                    </div>
                </div>

                <div className="shared-library-stats">
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.all}</span>
                        <span className="shared-library-stat-label">{t('shared.total')}</span>
                    </div>
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.used}</span>
                        <span className="shared-library-stat-label">{t('shared.inUse')}</span>
                    </div>
                    <div className="shared-library-stat">
                        <span className="shared-library-stat-value">{filterCounts.broken}</span>
                        <span className="shared-library-stat-label">{t('shared.broken')}</span>
                    </div>
                </div>

                <div className="shared-library-controls">
                    <div className="field field--flush">
                        <label className="label-sm">{t('shared.search')}</label>
                        <input
                            className="input"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t('shared.searchPlaceholder')}
                        />
                    </div>

                    <div className="shared-library-filter-row">
                        {(Object.keys(filterLabels) as SharedFilter[]).map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={`shared-library-filter ${filter === value ? 'active' : ''}`}
                                onClick={() => setFilter(value)}
                            >
                                {filterLabels[value]} ({filterCounts[value]})
                            </button>
                        ))}
                    </div>

                    <div className="field field--flush">
                        <label className="label-sm">{t('shared.sort')}</label>
                        <select
                            className="input"
                            value={sort}
                            onChange={(event) => setSort(event.target.value as SharedSort)}
                        >
                            {sortLabels.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {sharedSteps.length === 0 ? (
                    <div className="shared-library-empty">{t('shared.emptyLibrary')}</div>
                ) : filteredEntries.length === 0 ? (
                    <div className="shared-library-empty">{t('shared.emptyFiltered')}</div>
                ) : (
                    <>
                        <div className="shared-library-result-copy">
                            {t('shared.showing', { visible: filteredEntries.length, total: sharedSteps.length })}
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
                                        <span>{t('shared.stepsCount', { count: entry.shared.steps.length })}</span>
                                        <span>{t('shared.usagesCount', { count: entry.usageCount })}</span>
                                        {entry.brokenRefCount > 0 && <span>{t('shared.brokenRefs', { count: entry.brokenRefCount })}</span>}
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
                    <div className="shared-library-empty main">{t('shared.selectToEdit')}</div>
                ) : (
                    <>
                        <div className="shared-library-toolbar">
                            <div className="field field--flush field--grow">
                                <label className="label-sm">{t('shared.name')}</label>
                                <input
                                    className="input"
                                    value={selectedEntry.shared.name}
                                    onChange={(e) => onUpdateShared(selectedEntry.shared.id, { name: e.target.value })}
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

                        <div className="shared-library-usage-card">
                            <div className="shared-library-usage-title">{t('shared.usageTitle')}</div>
                            {usages.length === 0 ? (
                                <div className="shared-library-usage-empty">{t('shared.usageEmpty')}</div>
                            ) : (
                                <div className="shared-library-usage-list">
                                    {usages.map((usage) => (
                                        <button
                                            key={usage.id}
                                            type="button"
                                            className="shared-library-usage-item"
                                            onClick={() => onOpenUsage(usage)}
                                        >
                                            <span className="shared-library-usage-kind">{usage.kind === 'usesShared' ? t('shared.usageKindShared') : t('shared.usageKindRef')}</span>
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
