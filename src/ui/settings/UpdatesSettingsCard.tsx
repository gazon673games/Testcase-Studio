import * as React from 'react'
import type { AppInfo, AppUpdateCheckResult } from '@shared/appUpdates'
import { Alert } from './SettingsShared'
import type { SettingsTranslate } from './types'

type Props = {
    locale: 'ru' | 'en'
    appInfo: AppInfo | null
    updateInfo: AppUpdateCheckResult | null
    updateError: string | null
    checkingUpdates: boolean
    t: SettingsTranslate
    onCheckUpdates(): void
}

export function UpdatesSettingsCard({
    locale,
    appInfo,
    updateInfo,
    updateError,
    checkingUpdates,
    t,
    onCheckUpdates,
}: Props) {
    const buildMode = appInfo?.isPackaged ? t('settings.buildMode.packaged') : t('settings.buildMode.dev')
    const publishedLabel = updateInfo?.publishedAt
        ? new Date(updateInfo.publishedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')
        : ''

    const openExternal = React.useCallback((url: string | null | undefined) => {
        const next = String(url ?? '').trim()
        if (!next) return
        window.open(next, '_blank', 'noopener')
    }, [])

    return (
        <div className="settings-modal__update-card">
            <h4 className="settings-modal__section-title">{t('settings.updatesTitle')}</h4>

            <div className="settings-modal__update-grid">
                <div className="settings-modal__field">
                    <div className="settings-modal__label">{t('settings.currentVersion')}</div>
                    <div className="settings-modal__value">{appInfo?.version ?? '—'}</div>
                </div>
                <div className="settings-modal__field">
                    <div className="settings-modal__label">{t('settings.buildInfo')}</div>
                    <div className="settings-modal__value">
                        {appInfo
                            ? t('settings.buildInfoValue', {
                                platform: appInfo.platform,
                                arch: appInfo.arch,
                                mode: buildMode,
                            })
                            : '—'}
                    </div>
                </div>
            </div>

            <div className="settings-modal__hint">{t('settings.updateHint')}</div>

            {updateInfo?.updateAvailable ? (
                <Alert tone="info">
                    {t('settings.updateAvailable', { version: updateInfo.latestVersion ?? updateInfo.latestTag ?? '?' })}
                </Alert>
            ) : updateInfo ? (
                <Alert tone="ok">{t('settings.upToDate')}</Alert>
            ) : null}

            {updateError ? (
                <Alert tone="error">{t('settings.updateError', { message: updateError })}</Alert>
            ) : null}

            {updateInfo ? (
                <div className="settings-modal__update-grid">
                    <div className="settings-modal__field">
                        <div className="settings-modal__label">{t('settings.updateLatest')}</div>
                        <div className="settings-modal__value">
                            {updateInfo.latestVersion ?? updateInfo.latestTag ?? '—'}
                        </div>
                    </div>
                    <div className="settings-modal__field">
                        <div className="settings-modal__label">{t('settings.updatePublished')}</div>
                        <div className="settings-modal__value">{publishedLabel || '—'}</div>
                    </div>
                </div>
            ) : null}

            <div className="settings-modal__actions">
                <button
                    type="button"
                    onClick={onCheckUpdates}
                    disabled={checkingUpdates}
                    className="settings-modal__button settings-modal__button--secondary"
                >
                    {checkingUpdates ? t('settings.checkingUpdates') : t('settings.checkUpdates')}
                </button>
                {updateInfo?.releaseUrl ? (
                    <button
                        type="button"
                        onClick={() => openExternal(updateInfo.releaseUrl)}
                        className="settings-modal__button settings-modal__button--secondary"
                    >
                        {t('settings.openRelease')}
                    </button>
                ) : null}
                {updateInfo?.downloadUrl && updateInfo.downloadUrl !== updateInfo.releaseUrl ? (
                    <button
                        type="button"
                        onClick={() => openExternal(updateInfo.downloadUrl)}
                        className="settings-modal__button settings-modal__button--primary"
                    >
                        {t('settings.downloadUpdate')}
                    </button>
                ) : null}
            </div>
        </div>
    )
}
