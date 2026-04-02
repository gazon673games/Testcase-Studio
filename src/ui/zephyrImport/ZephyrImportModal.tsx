import * as React from 'react'
import type {
    ZephyrImportApplyResult,
    ZephyrImportMode,
    ZephyrImportPreview,
    ZephyrImportRequest,
    ZephyrImportStrategy,
} from '@app/sync'
import {
    PreviewAlert,
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewEmptyState,
    PreviewField,
    PreviewFilterChip,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
    PreviewStickyBar,
    PreviewToolbar,
    PreviewToolbarGroup,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { ZephyrImportPreviewItemCard } from './ZephyrImportPreviewItemCard'
import { useZephyrImportModalController } from './zephyrImportModalController'
import { type ImportStatusFilter, useZephyrImportDerivedState } from './zephyrImportModalDerived'

type Props = {
    open: boolean
    destinationLabel: string
    onClose(): void
    onPreview(request: Omit<ZephyrImportRequest, 'destinationFolderId'>): Promise<ZephyrImportPreview>
    onApply(preview: ZephyrImportPreview): Promise<ZephyrImportApplyResult>
}

export function ZephyrImportModal({ open, destinationLabel, onClose, onPreview, onApply }: Props) {
    const { t } = useUiPreferences()
    const projectInputRef = React.useRef<HTMLInputElement | null>(null)
    const folderInputRef = React.useRef<HTMLInputElement | null>(null)
    const refsInputRef = React.useRef<HTMLTextAreaElement | null>(null)
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    // Form state
    const [mode, setMode] = React.useState<ZephyrImportMode>('project')
    const [projectKey, setProjectKey] = React.useState('')
    const [folder, setFolder] = React.useState('')
    const [refsText, setRefsText] = React.useState('')
    const [rawQuery, setRawQuery] = React.useState('')
    const [maxResults, setMaxResults] = React.useState('100')
    const [mirrorRemoteFolders, setMirrorRemoteFolders] = React.useState(true)
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrImportPreview | null>(null)
    const [strategies, setStrategies] = React.useState<Record<string, ZephyrImportStrategy>>({})
    const [statusFilter, setStatusFilter] = React.useState<ImportStatusFilter>('all')
    const [showUnchanged, setShowUnchanged] = React.useState(false)

    React.useEffect(() => {
        if (!open) return
        itemRefs.current = {}
        setError(null)
        setPreview(null)
        setStrategies({})
        setStatusFilter('all')
        setShowUnchanged(false)
    }, [open, destinationLabel])

    // Derived preview state
    const {
        refs,
        request,
        items,
        conflictItems,
        replaceCount,
        strategySummary,
        visibleItems,
    } = useZephyrImportDerivedState({
        mode,
        projectKey,
        folder,
        refsText,
        rawQuery,
        maxResults,
        mirrorRemoteFolders,
        preview,
        strategies,
        statusFilter,
        showUnchanged,
    })

    const hiddenCount = items.length - visibleItems.length
    const hiddenUnchangedCount = items.filter(
        (item) => item.status === 'unchanged' && (statusFilter !== 'unchanged' || !showUnchanged)
    ).length
    const firstConflictId = conflictItems[0]?.id

    // Handlers
    const { handlePreview, handleApply } = useZephyrImportModalController({
        request,
        preview,
        strategies,
        itemRefs,
        onPreview,
        onApply,
        onClose,
        previewErrorMessage: t('import.previewError'),
        applyErrorMessage: t('import.applyError'),
        setLoading,
        setApplying,
        setError,
        setPreview,
        setStrategies,
        setStatusFilter,
        setShowUnchanged,
    })

    function handleStatusFilterChange(nextFilter: ImportStatusFilter) {
        if (nextFilter === 'unchanged') setShowUnchanged(true)
        setStatusFilter(nextFilter)
    }

    function handleShowUnchangedChange(checked: boolean) {
        setShowUnchanged(checked)
        if (!checked && statusFilter === 'unchanged') {
            setStatusFilter('all')
        }
    }

    function scrollToItem(itemId?: string) {
        if (!itemId) return
        const node = itemRefs.current[itemId]
        node?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        node?.focus?.()
    }

    const canPreview =
        !loading &&
        !applying &&
        ((mode === 'project' && projectKey.trim().length > 0) ||
            (mode === 'folder' && folder.trim().length > 0) ||
            (mode === 'keys' && refs.length > 0))
    const initialFocusRef =
        mode === 'keys'
            ? refsInputRef
            : mode === 'folder'
                ? folderInputRef
                : projectInputRef

    // Render
    return (
        <PreviewDialog
            open={open}
            title={t('import.title')}
            subtitle={t('import.subtitle', { label: destinationLabel })}
            onClose={onClose}
            initialFocusRef={initialFocusRef}
            canDismiss={!loading && !applying}
        >
            <PreviewDialogSplit
                sidebar={(
                    <form className="preview-dialog__column" onSubmit={handlePreview}>
                        <PreviewCard title={t('import.scope')}>
                            <div className="preview-dialog__tab-row">
                                {(['project', 'folder', 'keys'] as ZephyrImportMode[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`preview-dialog__tab-button${value === mode ? ' preview-dialog__tab-button--active' : ''}`}
                                        onClick={() => setMode(value)}
                                    >
                                        {t(`import.mode.${value}`)}
                                    </button>
                                ))}
                            </div>

                            {mode !== 'keys' && (
                                <PreviewField label={t('import.projectKey')}>
                                    <input
                                        ref={projectInputRef}
                                        className="preview-dialog__input"
                                        value={projectKey}
                                        onChange={(event) => setProjectKey(event.target.value)}
                                        placeholder="PROD"
                                    />
                                </PreviewField>
                            )}

                            {mode === 'folder' && (
                                <PreviewField label={t('import.folderPath')}>
                                    <input
                                        ref={folderInputRef}
                                        className="preview-dialog__input"
                                        value={folder}
                                        onChange={(event) => setFolder(event.target.value)}
                                        placeholder="/CORE/Regression/Auth"
                                    />
                                </PreviewField>
                            )}

                            {mode === 'keys' && (
                                <PreviewField label={t('import.keysOrIds')}>
                                    <textarea
                                        ref={refsInputRef}
                                        className="preview-dialog__textarea"
                                        value={refsText}
                                        onChange={(event) => setRefsText(event.target.value)}
                                        placeholder={'PROD-T6079\nPROD-T6209\n6078'}
                                        rows={6}
                                    />
                                </PreviewField>
                            )}

                            <PreviewField label={t('import.rawQuery')}>
                                <textarea
                                    className="preview-dialog__textarea"
                                    value={rawQuery}
                                    onChange={(event) => setRawQuery(event.target.value)}
                                    placeholder={t('import.rawQueryPlaceholder')}
                                    rows={4}
                                />
                            </PreviewField>

                            <div className="preview-dialog__inline-row">
                                <div className="preview-dialog__field-inline-grow">
                                    <PreviewField label={t('import.maxResults')}>
                                        <input
                                            className="preview-dialog__input"
                                            value={maxResults}
                                            onChange={(event) => setMaxResults(event.target.value)}
                                            inputMode="numeric"
                                            placeholder="100"
                                        />
                                    </PreviewField>
                                </div>
                                <label className="preview-dialog__checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={mirrorRemoteFolders}
                                        onChange={(event) => setMirrorRemoteFolders(event.target.checked)}
                                    />
                                    {t('import.mirrorFolders')}
                                </label>
                            </div>

                            <PreviewHint>
                                {t('import.scopeHint')}
                            </PreviewHint>
                        </PreviewCard>

                        {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

                        <div className="preview-dialog__button-row">
                            <PreviewButton type="submit" tone="primary" disabled={!canPreview}>
                                {loading ? t('import.loadingPreview') : t('import.loadPreview')}
                            </PreviewButton>
                            <PreviewButton type="button" tone="ghost" onClick={onClose} disabled={loading || applying}>
                                {t('import.close')}
                            </PreviewButton>
                        </div>
                    </form>
                )}
                content={(
                    <div className="preview-dialog__column">
                        {!preview ? (
                            <PreviewEmptyState title={t('import.previewEmptyTitle')}>
                                {t('import.previewEmptyText')}
                            </PreviewEmptyState>
                        ) : (
                            <>
                                <PreviewCard>
                                    <div className="preview-dialog__summary-row">
                                        <div>
                                            <div className="preview-dialog__card-title">{t('import.previewTitle')}</div>
                                            <div className="preview-dialog__subtitle">
                                                {t('import.query')}: <code>{preview.query || t('import.directLookup')}</code>
                                            </div>
                                        </div>
                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="neutral">{t('import.total', { count: preview.summary.total })}</PreviewBadge>
                                            <PreviewBadge tone="ok">{t('import.new', { count: preview.summary.created })}</PreviewBadge>
                                            <PreviewBadge tone="info">{t('import.updates', { count: preview.summary.updates })}</PreviewBadge>
                                            <PreviewBadge tone="warn">{t('import.conflicts', { count: preview.summary.conflicts })}</PreviewBadge>
                                            <PreviewBadge tone="muted">{t('import.unchanged', { count: preview.summary.unchanged })}</PreviewBadge>
                                        </div>
                                    </div>
                                </PreviewCard>

                                {conflictItems.length > 0 ? (
                                    <PreviewCard title={t('import.conflictsTitle')}>
                                        <PreviewToolbar>
                                            <PreviewToolbarGroup>
                                                <PreviewHint>
                                                    {t('import.conflictsHint')}
                                                </PreviewHint>
                                            </PreviewToolbarGroup>
                                            <PreviewToolbarGroup align="end">
                                                <PreviewButton
                                                    tone="soft"
                                                    onClick={() => handleStatusFilterChange('conflict')}
                                                >
                                                    {t('import.onlyConflicts')}
                                                </PreviewButton>
                                                <PreviewButton
                                                    tone="ghost"
                                                    onClick={() => scrollToItem(firstConflictId)}
                                                    disabled={!firstConflictId}
                                                >
                                                    {t('import.jumpFirstConflict')}
                                                </PreviewButton>
                                            </PreviewToolbarGroup>
                                        </PreviewToolbar>

                                        <div className="preview-dialog__badge-row">
                                            <PreviewBadge tone="info">{t('import.replaceCount', { count: strategySummary.replace })}</PreviewBadge>
                                            <PreviewBadge tone="muted">{t('import.skipCount', { count: strategySummary.skip })}</PreviewBadge>
                                            <PreviewBadge tone="warn">{t('import.mergeLaterCount', { count: strategySummary['merge-locally-later'] })}</PreviewBadge>
                                        </div>

                                        <div className="preview-dialog__quick-list">
                                            {conflictItems.slice(0, 4).map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className="preview-dialog__quick-link"
                                                    onClick={() => scrollToItem(item.id)}
                                                >
                                                    {item.remoteName}
                                                </button>
                                            ))}
                                            {conflictItems.length > 4 ? (
                                                <PreviewHint>{t('import.moreConflicts', { count: conflictItems.length - 4 })}</PreviewHint>
                                            ) : null}
                                        </div>
                                    </PreviewCard>
                                ) : null}

                                <PreviewCard title={t('import.reviewFilters')}>
                                    <PreviewToolbar>
                                        <PreviewToolbarGroup>
                                            <PreviewFilterChip
                                                active={statusFilter === 'all'}
                                                onClick={() => handleStatusFilterChange('all')}
                                            >
                                                {t('import.filter.all', { count: preview.summary.total })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'new'}
                                                onClick={() => handleStatusFilterChange('new')}
                                            >
                                                {t('import.filter.new', { count: preview.summary.created })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'update'}
                                                onClick={() => handleStatusFilterChange('update')}
                                            >
                                                {t('import.filter.updates', { count: preview.summary.updates })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'conflict'}
                                                onClick={() => handleStatusFilterChange('conflict')}
                                            >
                                                {t('import.filter.conflicts', { count: preview.summary.conflicts })}
                                            </PreviewFilterChip>
                                            <PreviewFilterChip
                                                active={statusFilter === 'unchanged'}
                                                onClick={() => handleStatusFilterChange('unchanged')}
                                            >
                                                {t('import.filter.unchanged', { count: preview.summary.unchanged })}
                                            </PreviewFilterChip>
                                        </PreviewToolbarGroup>
                                        <PreviewToolbarGroup align="end">
                                            <label className="preview-dialog__toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={showUnchanged}
                                                    onChange={(event) => handleShowUnchangedChange(event.target.checked)}
                                                />
                                                {t('import.showUnchanged')}
                                            </label>
                                            {hiddenCount > 0 ? (
                                                <PreviewBadge tone="muted">{t('import.hidden', { count: hiddenCount })}</PreviewBadge>
                                            ) : null}
                                        </PreviewToolbarGroup>
                                    </PreviewToolbar>
                                </PreviewCard>

                                {hiddenUnchangedCount > 0 && !showUnchanged && statusFilter !== 'unchanged' ? (
                                    <PreviewCard className="preview-dialog__collapsed-note">
                                        <PreviewHint>
                                            {t('import.collapsedUnchanged', { count: hiddenUnchangedCount })}
                                        </PreviewHint>
                                    </PreviewCard>
                                ) : null}

                                <div className="preview-dialog__list">
                                    {items.length === 0 ? (
                                        <PreviewEmptyState title={t('import.emptyFound')}>
                                            {t('import.emptyFoundText')}
                                        </PreviewEmptyState>
                                    ) : visibleItems.length === 0 ? (
                                        <PreviewEmptyState title={t('import.emptyFilters')}>
                                            {t('import.emptyFiltersText')}
                                        </PreviewEmptyState>
                                    ) : (
                                        visibleItems.map((item) => (
                                            <ZephyrImportPreviewItemCard
                                                key={item.id}
                                                item={item}
                                                strategy={strategies[item.id] ?? item.strategy}
                                                onChangeStrategy={(value) =>
                                                    setStrategies((current) => ({ ...current, [item.id]: value }))
                                                }
                                                containerRef={(node) => {
                                                    itemRefs.current[item.id] = node
                                                }}
                                            />
                                        ))
                                    )}
                                </div>

                                <PreviewStickyBar>
                                    <div className="preview-dialog__sticky-summary">
                                        <span>{t('import.shown', { count: visibleItems.length })}</span>
                                        <PreviewBadge tone="info">{t('import.replaceCount', { count: replaceCount })}</PreviewBadge>
                                        {hiddenCount > 0 ? <PreviewBadge tone="muted">{t('import.hidden', { count: hiddenCount })}</PreviewBadge> : null}
                                    </div>
                                    <div className="preview-dialog__button-row">
                                        <PreviewButton
                                            tone="ghost"
                                            onClick={() => {
                                                setStatusFilter('all')
                                                setShowUnchanged(false)
                                            }}
                                            disabled={applying || loading}
                                        >
                                            {t('import.resetFilters')}
                                        </PreviewButton>
                                        <PreviewButton
                                            tone="primary"
                                            disabled={applying || loading || items.length === 0}
                                            onClick={handleApply}
                                        >
                                            {applying ? t('import.applying') : t('import.apply')}
                                        </PreviewButton>
                                    </div>
                                </PreviewStickyBar>
                            </>
                        )}
                    </div>
                )}
            />
        </PreviewDialog>
    )
}
