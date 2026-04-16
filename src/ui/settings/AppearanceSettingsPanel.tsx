import * as React from 'react'
import type { AppInfo, AppUpdateCheckResult } from '@shared/appUpdates'
import type { UiLocale, UiThemeMode } from '../preferences'
import { Field } from './SettingsShared'
import { UpdatesSettingsCard } from './UpdatesSettingsCard'
import type { SettingsTranslate } from './types'
import antIconUrl from '../assets/icons/ant.svg'

type Props = {
    locale: UiLocale
    themeMode: UiThemeMode
    jsonBeautifyTolerant: boolean
    appInfo: AppInfo | null
    updateInfo: AppUpdateCheckResult | null
    updateError: string | null
    checkingUpdates: boolean
    windowIconDataUrl: string | null
    iconStatus: 'idle' | 'applying' | 'applied'
    t: SettingsTranslate
    onSetLocale(value: UiLocale): void
    onSetThemeMode(value: UiThemeMode): void
    onSetJsonBeautifyTolerant(value: boolean): void
    onCheckUpdates(): void
    onClose(): void
    onSetAntIcon(): void
    onPickIconFile(): void
    onResetIcon(): void
}

export function AppearanceSettingsPanel(props: Props) {
    const applyingIcon = props.iconStatus === 'applying'

    return (
        <div className="settings-modal__form">
            <h4 className="settings-modal__section-title">{props.t('settings.appearanceTitle')}</h4>

            <Field label={props.t('settings.appIcon')}>
                <div className="settings-modal__icon-row">
                    <div className="settings-modal__icon-preview" title={props.t('settings.appIcon')}>
                        {props.windowIconDataUrl
                            ? <img src={props.windowIconDataUrl} alt={props.t('settings.appIcon')} className="settings-modal__icon-img" />
                            : <span className="settings-modal__icon-placeholder">{props.t('settings.appIcon.default')}</span>
                        }
                    </div>
                    <div className="settings-modal__icon-actions">
                        <button
                            type="button"
                            className="settings-modal__icon-option"
                            disabled={applyingIcon}
                            onClick={props.onSetAntIcon}
                            title={props.t('settings.appIcon.ant')}
                        >
                            <img src={antIconUrl} alt="" className="settings-modal__icon-option-img" />
                            <span>{props.t('settings.appIcon.ant')}</span>
                        </button>
                        <button
                            type="button"
                            className="settings-modal__button settings-modal__button--secondary"
                            disabled={applyingIcon}
                            onClick={props.onPickIconFile}
                        >
                            {props.t('settings.appIcon.fromFile')}
                        </button>
                        {props.windowIconDataUrl && (
                            <button
                                type="button"
                                className="settings-modal__button settings-modal__button--secondary"
                                disabled={applyingIcon}
                                onClick={props.onResetIcon}
                            >
                                {props.t('settings.appIcon.reset')}
                            </button>
                        )}
                    </div>
                </div>
                {props.iconStatus === 'applying' && (
                    <div className="settings-modal__hint">{props.t('settings.appIcon.applying')}</div>
                )}
                {props.iconStatus === 'applied' && (
                    <div className="settings-modal__hint settings-modal__hint--ok">{props.t('settings.appIcon.applied')}</div>
                )}
                <div className="settings-modal__hint">{props.t('settings.appIcon.hint')}</div>
            </Field>

            <Field label={props.t('settings.language')}>
                <select
                    value={props.locale}
                    onChange={(event) => props.onSetLocale(event.target.value as UiLocale)}
                    className="settings-modal__input"
                >
                    <option value="ru">{props.t('settings.language.ru')}</option>
                    <option value="en">{props.t('settings.language.en')}</option>
                </select>
                <div className="settings-modal__hint">{props.t('settings.languageHint')}</div>
            </Field>

            <Field label={props.t('settings.theme')}>
                <select
                    value={props.themeMode}
                    onChange={(event) => props.onSetThemeMode(event.target.value as UiThemeMode)}
                    className="settings-modal__input"
                >
                    <option value="dark">{props.t('settings.theme.dark')}</option>
                    <option value="light">{props.t('settings.theme.light')}</option>
                </select>
                <div className="settings-modal__hint">{props.t('settings.themeHint')}</div>
            </Field>

            <div className="settings-modal__field">
                <label className="settings-modal__checkbox">
                    <input
                        type="checkbox"
                        checked={props.jsonBeautifyTolerant}
                        onChange={(event) => props.onSetJsonBeautifyTolerant(event.target.checked)}
                    />
                    <span>{props.t('settings.jsonBeautifyTolerant')}</span>
                </label>
                <div className="settings-modal__hint">{props.t('settings.jsonBeautifyTolerantHint')}</div>
            </div>

            <UpdatesSettingsCard
                locale={props.locale}
                appInfo={props.appInfo}
                updateInfo={props.updateInfo}
                updateError={props.updateError}
                checkingUpdates={props.checkingUpdates}
                t={props.t}
                onCheckUpdates={props.onCheckUpdates}
            />

            <div className="settings-modal__actions">
                <button
                    type="button"
                    onClick={props.onClose}
                    className="settings-modal__button settings-modal__button--primary"
                >
                    {props.t('settings.close')}
                </button>
            </div>
        </div>
    )
}
