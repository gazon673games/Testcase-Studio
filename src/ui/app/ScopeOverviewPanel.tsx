import React from 'react'
import { useUiPreferences } from '../preferences'
import type { SelectionSummary } from './selectionSummary'

type ScopeOverviewPanelProps = {
    summary: SelectionSummary
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    onOpenImport(): void
    onOpenPublish(): void
    onAddFolder(): void
    onAddTest(): void
}

export function ScopeOverviewPanel({
    summary,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    onOpenImport,
    onOpenPublish,
    onAddFolder,
    onAddTest,
}: ScopeOverviewPanelProps) {
    const { t } = useUiPreferences()

    return (
        <div className="scope-overview">
            <div className="scope-overview__hero">
                <div className="overview-eyebrow">
                    {summary.kind === 'root' ? t('overview.zephyrWorkspace') : summary.kind === 'folder' ? t('tree.folder') : t('toolbar.editor')}
                </div>
                <div className="scope-overview__title">{summary.title}</div>
                <div className="scope-overview__subtitle">{summary.subtitle}</div>
                <div className="scope-overview__path">
                    <code>{summary.pathLabel}</code>
                </div>
            </div>

            <div className="scope-overview__stats">
                <OverviewStat label={t('tree.folder')} value={String(summary.folderCount)} hint={t('tree.itemCount', { count: summary.folderCount })} />
                <OverviewStat label={t('overview.casesInScope')} value={String(summary.testCount)} hint={t('overview.casesInScopeHint')} />
                <OverviewStat label={t('tree.cases')} value={String(summary.directChildrenCount)} hint={t('tree.itemCount', { count: summary.directChildrenCount })} />
            </div>

            <div className="scope-overview__actions">
                <ActionCard
                    label={t('overview.importFromZephyr')}
                    title={importDestinationLabel}
                    description={t('overview.importFromZephyrDescription')}
                    tone="info"
                    actionLabel={t('overview.openImport')}
                    onAction={onOpenImport}
                />
                <ActionCard
                    label={t('overview.publishToZephyr')}
                    title={publishSelectionLabel}
                    description={
                        publishCount === 0
                            ? t('toolbar.publishScopeEmpty')
                            : publishCount === 1
                                ? t('toolbar.publishScopeLabel', { label: publishSelectionLabel })
                                : t('toolbar.publishScopeCount', { count: publishCount })
                    }
                    tone={publishCount === 0 ? 'neutral' : publishCount > 1 ? 'warn' : 'danger'}
                    actionLabel={t('overview.openPublish')}
                    onAction={publishCount > 0 ? onOpenPublish : undefined}
                />
                <ActionCard
                    label={t('toolbar.local')}
                    title={t('toolbar.editor')}
                    description={t('overview.zephyrWorkspace')}
                    tone="neutral"
                    extra={
                        <div className="scope-overview__quick-actions">
                            <QuickActionButton onClick={onAddFolder}>{t('overview.newFolder')}</QuickActionButton>
                            <QuickActionButton onClick={onAddTest}>{t('overview.newCase')}</QuickActionButton>
                        </div>
                    }
                />
            </div>
        </div>
    )
}

function OverviewStat({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div className="overview-stat">
            <div className="overview-eyebrow">{label}</div>
            <div className="overview-stat__value">{value}</div>
            <div className="overview-stat__hint">{hint}</div>
        </div>
    )
}

function ActionCard({
    label,
    title,
    description,
    tone,
    actionLabel,
    onAction,
    extra,
}: {
    label: string
    title: string
    description: string
    tone: 'neutral' | 'info' | 'warn' | 'danger'
    actionLabel?: string
    onAction?: () => void
    extra?: React.ReactNode
}) {
    return (
        <div className={`overview-card tone-${tone}`}>
            <div className="overview-eyebrow overview-card__eyebrow">{label}</div>
            <div className="overview-card__title">{title}</div>
            <div className="overview-card__description">{description}</div>
            {actionLabel && onAction ? <QuickActionButton onClick={onAction}>{actionLabel}</QuickActionButton> : null}
            {extra}
        </div>
    )
}

function QuickActionButton({ children, onClick }: { children: React.ReactNode; onClick(): void }) {
    return (
        <button type="button" onClick={onClick} className="overview-button">
            {children}
        </button>
    )
}
