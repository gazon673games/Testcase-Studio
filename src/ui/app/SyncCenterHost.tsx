import React from 'react'
import { useUiPreferences } from '../preferences'

type SyncCenterHostProps = {
    open: boolean
    selectionLabel: string
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    canPull: boolean
    canPublish: boolean
    canSyncAll: boolean
    onClose(): void
    onOpenImport(): void
    onOpenPublish(): void
    onPull(): void
    onSyncAll(): void
}

export function SyncCenterHost(props: SyncCenterHostProps) {
    if (!props.open) return null

    return (
        <>
            <button type="button" aria-label="Close sync center" onClick={props.onClose} style={syncBackdropStyle} />
            <SyncCenterPanel {...props} />
        </>
    )
}

function SyncCenterPanel({
    selectionLabel,
    importDestinationLabel,
    publishSelectionLabel,
    publishCount,
    canPull,
    canPublish,
    canSyncAll,
    onClose,
    onOpenImport,
    onOpenPublish,
    onPull,
    onSyncAll,
}: SyncCenterHostProps) {
    const { t } = useUiPreferences()

    return (
        <aside style={syncPanelStyle} aria-label={t('toolbar.syncCenter')}>
            <div style={syncPanelHeaderStyle}>
                <div style={{ display: 'grid', gap: 4 }}>
                    <div style={eyebrowStyle}>{t('toolbar.syncCenter')}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>{t('overview.zephyrWorkspace')}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>{t('toolbar.syncCenterTitle')}</div>
                </div>
                <button type="button" onClick={onClose} style={syncPanelCloseStyle}>
                    {t('sync.close')}
                </button>
            </div>

            <div style={syncPanelBodyStyle}>
                <SyncInfoCard label={t('toolbar.editor')} value={selectionLabel} hint={selectionLabel} />
                <SyncInfoCard label={t('sync.importTarget')} value={importDestinationLabel} hint={t('sync.importTargetHint')} />
                <SyncInfoCard
                    label={t('sync.publishScope')}
                    value={
                        publishCount === 0
                            ? t('toolbar.publishScopeEmpty')
                            : publishCount === 1
                                ? publishSelectionLabel
                                : t('toolbar.publishScopeCount', { count: publishCount })
                    }
                    hint={t('sync.publishScopeHint')}
                    tone={publishCount > 0 ? 'warn' : 'neutral'}
                />

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>{t('toolbar.panels')}</div>
                    <button type="button" onClick={onOpenImport} style={syncPrimaryButtonStyle}>
                        {t('sync.importFromZephyr')}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenPublish}
                        disabled={!canPublish}
                        style={{ ...syncDangerButtonStyle, opacity: canPublish ? 1 : 0.45, cursor: canPublish ? 'pointer' : 'default' }}
                    >
                        {t('sync.publishToZephyr')}
                    </button>
                </div>

                <div style={syncActionGroupStyle}>
                    <div style={syncActionGroupTitleStyle}>{t('toolbar.more')}</div>
                    <button
                        type="button"
                        onClick={onPull}
                        disabled={!canPull}
                        style={{ ...syncSecondaryButtonStyle, opacity: canPull ? 1 : 0.45, cursor: canPull ? 'pointer' : 'default' }}
                    >
                        {t('sync.pullCurrent')}
                    </button>
                    <button
                        type="button"
                        onClick={onSyncAll}
                        disabled={!canSyncAll}
                        style={{ ...syncSecondaryButtonStyle, opacity: canSyncAll ? 1 : 0.45, cursor: canSyncAll ? 'pointer' : 'default' }}
                    >
                        {t('sync.quickSync')}
                    </button>
                </div>
            </div>
        </aside>
    )
}

function SyncInfoCard({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint: string; tone?: 'neutral' | 'warn' }) {
    return (
        <div
            style={{
                border: `1px solid ${tone === 'warn' ? 'var(--warning-border)' : 'var(--border-soft)'}`,
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                padding: 14,
                display: 'grid',
                gap: 6,
            }}
        >
            <div style={eyebrowStyle}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-muted)' }}>{hint}</div>
        </div>
    )
}

const eyebrowStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-dim)',
}

const syncBackdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: 'none',
    background: 'var(--bg-overlay)',
    cursor: 'pointer',
}

const syncPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    right: 12,
    bottom: 12,
    width: 'min(336px, calc(100vw - 24px))',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: 14,
    padding: 16,
    border: '1px solid var(--border)',
    borderRadius: 18,
    background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
    boxShadow: 'var(--shadow-strong)',
    zIndex: 5,
    backdropFilter: 'blur(10px)',
}

const syncPanelHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
}

const syncPanelCloseStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '7px 10px',
    fontWeight: 700,
    cursor: 'pointer',
}

const syncPanelBodyStyle: React.CSSProperties = {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
    overflow: 'auto',
    paddingRight: 2,
}

const syncActionGroupStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
    padding: 14,
    border: '1px solid var(--border-soft)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
}

const syncActionGroupTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
}

const syncPrimaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent-text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
    cursor: 'pointer',
}

const syncDangerButtonStyle: React.CSSProperties = {
    border: '1px solid var(--danger-border)',
    background: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}

const syncSecondaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 700,
}
