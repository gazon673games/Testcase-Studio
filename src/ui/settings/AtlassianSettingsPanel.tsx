import * as React from 'react'
import { Alert, Field } from './SettingsShared'
import type { SettingsTranslate } from './types'

type Props = {
    loading: boolean
    login: string
    baseUrl: string
    secret: string
    hasSecret: boolean
    saved: 'idle' | 'ok' | 'err'
    canSave: boolean
    loginRef: React.RefObject<HTMLInputElement | null>
    secretRef: React.RefObject<HTMLInputElement | null>
    t: SettingsTranslate
    onChangeLogin(value: string): void
    onChangeBaseUrl(value: string): void
    onChangeSecret(value: string): void
    onSave(event?: React.FormEvent): void
    onClose(): void
}

export function AtlassianSettingsPanel(props: Props) {
    if (props.loading) return <div>{props.t('settings.loading')}</div>

    return (
        <form onSubmit={props.onSave} className="settings-modal__form">
            <h4 className="settings-modal__section-title">{props.t('settings.atlassianTitle')}</h4>
            {props.saved === 'ok' ? <Alert tone="ok">{props.t('settings.saved')}</Alert> : null}
            {props.saved === 'err' ? <Alert tone="error">{props.t('settings.saveError')}</Alert> : null}

            <Field label={props.t('settings.baseUrl')}>
                <input
                    value={props.baseUrl}
                    onChange={(event) => props.onChangeBaseUrl(event.target.value)}
                    className="settings-modal__input"
                    placeholder="https://jira.mycompany.com"
                    autoComplete="url"
                />
            </Field>

            <Field label={props.t('settings.login')}>
                <input
                    ref={props.loginRef}
                    value={props.login}
                    onChange={(event) => props.onChangeLogin(event.target.value)}
                    className="settings-modal__input"
                    autoComplete="username"
                />
            </Field>

            <Field
                label={(
                    <>
                        {props.t('settings.password')}
                        {props.hasSecret ? (
                            <span className="settings-modal__chip">
                                {props.t('settings.passwordStored')}
                            </span>
                        ) : null}
                    </>
                )}
            >
                <div className="settings-modal__secret-field">
                    <input
                        ref={props.secretRef}
                        value={props.secret}
                        onChange={(event) => props.onChangeSecret(event.target.value)}
                        className="settings-modal__input"
                        placeholder={props.hasSecret ? props.t('settings.passwordPlaceholder') : ''}
                        type="password"
                        autoComplete="current-password"
                    />
                </div>
            </Field>

            <Alert tone="info">{props.t('settings.securityHint')}</Alert>

            <div className="settings-modal__actions">
                <button
                    type="submit"
                    disabled={!props.canSave}
                    className="settings-modal__button settings-modal__button--primary"
                >
                    {props.t('settings.save')}
                </button>
                <button
                    type="button"
                    onClick={props.onClose}
                    className="settings-modal__button settings-modal__button--secondary"
                >
                    {props.t('settings.close')}
                </button>
            </div>
        </form>
    )
}
