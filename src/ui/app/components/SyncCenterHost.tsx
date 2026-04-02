import React from 'react'
import { useUiPreferences } from '../../preferences'

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
            <button type="button" aria-label="Close sync center" onClick={props.onClose} className="sync-center-backdrop" />
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
        <aside className="sync-center" aria-label={t('toolbar.syncCenter')}>
            <div className="sync-center__header">
                <div className="sync-center__header-copy">
                    <div className="overview-eyebrow">{t('toolbar.syncCenter')}</div>
                    <div className="sync-center__title">{t('overview.zephyrWorkspace')}</div>
                    <div className="sync-center__subtitle">{t('toolbar.syncCenterTitle')}</div>
                </div>
                <button type="button" onClick={onClose} className="sync-center__close">
                    {t('sync.close')}
                </button>
            </div>

            <div className="sync-center__body">
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

                <div className="sync-center__group">
                    <div className="sync-center__group-title">{t('toolbar.panels')}</div>
                    <button type="button" onClick={onOpenImport} className="sync-center__button sync-center__button--primary">
                        {t('sync.importFromZephyr')}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenPublish}
                        disabled={!canPublish}
                        className={`sync-center__button sync-center__button--danger${canPublish ? '' : ' is-disabled'}`}
                    >
                        {t('sync.publishToZephyr')}
                    </button>
                </div>

                <div className="sync-center__group">
                    <div className="sync-center__group-title">{t('toolbar.more')}</div>
                    <button
                        type="button"
                        onClick={onPull}
                        disabled={!canPull}
                        className={`sync-center__button sync-center__button--secondary${canPull ? '' : ' is-disabled'}`}
                    >
                        {t('sync.pullCurrent')}
                    </button>
                    <button
                        type="button"
                        onClick={onSyncAll}
                        disabled={!canSyncAll}
                        className={`sync-center__button sync-center__button--secondary${canSyncAll ? '' : ' is-disabled'}`}
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
        <div className={`sync-center__card${tone === 'warn' ? ' tone-warn' : ''}`}>
            <div className="overview-eyebrow">{label}</div>
            <div className="sync-center__card-value">{value}</div>
            <div className="sync-center__card-hint">{hint}</div>
        </div>
    )
}
