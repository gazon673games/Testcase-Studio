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
        <div style={{ padding: 20, display: 'grid', gap: 16, maxWidth: 920 }}>
            <div
                style={{
                    display: 'grid',
                    gap: 6,
                    padding: 18,
                    borderRadius: 18,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                }}
            >
                <div style={eyebrowStyle}>
                    {summary.kind === 'root' ? t('overview.zephyrWorkspace') : summary.kind === 'folder' ? t('tree.folder') : t('toolbar.editor')}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-strong)' }}>{summary.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>{summary.subtitle}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    <code>{summary.pathLabel}</code>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <OverviewStat label={t('tree.folder')} value={String(summary.folderCount)} hint={t('tree.itemCount', { count: summary.folderCount })} />
                <OverviewStat label={t('overview.casesInScope')} value={String(summary.testCount)} hint={t('overview.casesInScopeHint')} />
                <OverviewStat label={t('tree.cases')} value={String(summary.directChildrenCount)} hint={t('tree.itemCount', { count: summary.directChildrenCount })} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
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
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        <div
            style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                padding: '14px 16px',
                display: 'grid',
                gap: 4,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: 'var(--text-strong)' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{hint}</div>
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
    const accents =
        tone === 'info'
            ? { border: 'var(--accent-border)', background: 'var(--accent-bg)', label: 'var(--accent-text)' }
            : tone === 'warn'
                ? { border: 'var(--warning-border)', background: 'var(--warning-bg)', label: 'var(--warning-text)' }
                : tone === 'danger'
                    ? { border: 'var(--danger-border)', background: 'var(--danger-bg)', label: 'var(--danger-text)' }
                    : { border: 'var(--border)', background: 'var(--bg-elevated)', label: 'var(--text-muted)' }

    return (
        <div
            style={{
                border: `1px solid ${accents.border}`,
                borderRadius: 14,
                background: accents.background,
                padding: 16,
                display: 'grid',
                gap: 8,
                alignContent: 'start',
            }}
        >
            <div style={{ ...eyebrowStyle, color: accents.label }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted)' }}>{description}</div>
            {actionLabel && onAction ? <QuickActionButton onClick={onAction}>{actionLabel}</QuickActionButton> : null}
            {extra}
        </div>
    )
}

function QuickActionButton({ children, onClick }: { children: React.ReactNode; onClick(): void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                border: '1px solid var(--accent-border)',
                background: 'var(--bg-elevated)',
                color: 'var(--accent-text)',
                borderRadius: 10,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    )
}

const eyebrowStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-dim)',
}
