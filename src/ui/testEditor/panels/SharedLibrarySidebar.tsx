import * as React from 'react'
import type { SharedStep } from '@core/domain'
import { useUiPreferences } from '../../preferences'
import type { SharedFilter, SharedListEntry, SharedSort } from './sharedLibraryDerived'

type Props = {
    extraHeaderAction?: React.ReactNode
    sharedSteps: SharedStep[]
    query: string
    filter: SharedFilter
    sort: SharedSort
    filterCounts: Record<SharedFilter, number>
    filteredEntries: SharedListEntry[]
    selectedEntryId: string | null
    onQueryChange(value: string): void
    onFilterChange(value: SharedFilter): void
    onSortChange(value: SharedSort): void
    onSelectShared(sharedId: string): void
    onAddShared(): void | Promise<void>
}

export function SharedLibrarySidebar({
    extraHeaderAction,
    sharedSteps,
    query,
    filter,
    sort,
    filterCounts,
    filteredEntries,
    selectedEntryId,
    onQueryChange,
    onFilterChange,
    onSortChange,
    onSelectShared,
    onAddShared,
}: Props) {
    const { t } = useUiPreferences()

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

    return (
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
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder={t('shared.searchPlaceholder')}
                    />
                </div>

                <div className="shared-library-filter-row">
                    {(Object.keys(filterLabels) as SharedFilter[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={`shared-library-filter ${filter === value ? 'active' : ''}`}
                            onClick={() => onFilterChange(value)}
                        >
                            {filterLabels[value]} ({filterCounts[value]})
                        </button>
                    ))}
                </div>

                <div className="field field--flush">
                    <label className="label-sm">{t('shared.sort')}</label>
                    <select className="input" value={sort} onChange={(event) => onSortChange(event.target.value as SharedSort)}>
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
                                className={`shared-library-item ${selectedEntryId === entry.shared.id ? 'active' : ''}`}
                                onClick={() => onSelectShared(entry.shared.id)}
                            >
                                <div className="shared-library-item-title">{entry.shared.name}</div>
                                <div className="shared-library-item-meta">
                                    <span>{t('shared.stepsCount', { count: entry.shared.steps.length })}</span>
                                    <span>{t('shared.usagesCount', { count: entry.usageCount })}</span>
                                    {entry.brokenRefCount > 0 ? (
                                        <span>{t('shared.brokenRefs', { count: entry.brokenRefCount })}</span>
                                    ) : null}
                                </div>
                                {entry.preview ? <div className="shared-library-item-preview">{entry.preview}</div> : null}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
