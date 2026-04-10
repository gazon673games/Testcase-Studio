import * as React from 'react'
import type { AppUpdateCheckResult } from '@shared/appUpdates'
import { useUiPreferences } from '../../preferences'

type Props = {
    update: AppUpdateCheckResult | null
    onClose(): void
}

export function AppUpdateModal({ update, onClose }: Props) {
    const { t } = useUiPreferences()

    const openExternal = React.useCallback((url: string | null | undefined) => {
        const next = String(url ?? '').trim()
        if (!next) return
        window.open(next, '_blank', 'noopener')
    }, [])

    if (!update) return null

    return (
        <div className="app-update-modal__backdrop">
            <div className="app-update-modal" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
                <div className="app-update-modal__header">
                    <div className="app-update-modal__title" id="app-update-title">
                        {t('app.updateAvailableTitle')}
                    </div>
                    <button
                        type="button"
                        className="app-update-modal__close"
                        onClick={onClose}
                        title={t('app.updateDismiss')}
                    >
                        x
                    </button>
                </div>
                <div className="app-update-modal__body">
                    <div className="app-update-modal__text">
                        {t('app.updateAvailableMessage', {
                            current: update.version,
                            latest: update.latestVersion ?? update.latestTag ?? '?',
                        })}
                    </div>
                    {update.downloadName ? (
                        <div className="app-update-modal__hint">{update.downloadName}</div>
                    ) : null}
                    <div className="app-update-modal__actions">
                        {update.downloadUrl ? (
                            <button
                                type="button"
                                className="overview-button"
                                onClick={() => openExternal(update.downloadUrl)}
                            >
                                {t('app.updateDownload')}
                            </button>
                        ) : null}
                        {update.releaseUrl ? (
                            <button
                                type="button"
                                className="overview-button app-update-modal__button--secondary"
                                onClick={() => openExternal(update.releaseUrl)}
                            >
                                {t('app.updateOpenRelease')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="overview-button app-update-modal__button--secondary"
                            onClick={onClose}
                        >
                            {t('app.updateDismiss')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
