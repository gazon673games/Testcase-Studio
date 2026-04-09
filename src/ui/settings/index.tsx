import * as React from 'react'
import { apiClient } from '@ipc/client'
import type { AtlassianSettings } from '@core/settings'
import type { AppInfo, AppUpdateCheckResult } from '@shared/appUpdates'
import { useUiPreferences, type UiLocale, type UiThemeMode } from '../preferences'
import './Settings.css'

type Props = { open: boolean; onClose(): void }

const TABS = ['atlassian', 'appearance'] as const
type TabKey = typeof TABS[number]

export function SettingsModal({ open, onClose }: Props) {
    const { locale, setLocale, themeMode, setThemeMode, jsonBeautifyTolerant, setJsonBeautifyTolerant, t } = useUiPreferences()
    const [tab, setTab] = React.useState<TabKey>('atlassian')
    const [loading, setLoading] = React.useState(true)
    const [login, setLogin] = React.useState('')
    const [baseUrl, setBaseUrl] = React.useState('')
    const [secret, setSecret] = React.useState('')
    const [hasSecret, setHasSecret] = React.useState(false)
    const [saved, setSaved] = React.useState<'idle' | 'ok' | 'err'>('idle')
    const [appInfo, setAppInfo] = React.useState<AppInfo | null>(null)
    const [updateInfo, setUpdateInfo] = React.useState<AppUpdateCheckResult | null>(null)
    const [updateError, setUpdateError] = React.useState<string | null>(null)
    const [checkingUpdates, setCheckingUpdates] = React.useState(false)
    const loginRef = React.useRef<HTMLInputElement | null>(null)
    const secretRef = React.useRef<HTMLInputElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        setLoading(true)
        setSaved('idle')
        setSecret('')
        setUpdateError(null)
        apiClient.loadSettings()
            .then((settings: AtlassianSettings) => {
                setLogin(settings.login ?? '')
                setBaseUrl(settings.baseUrl ?? '')
                setHasSecret(settings.hasSecret)
            })
            .finally(() => setLoading(false))
        apiClient.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }, [open])

    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    React.useEffect(() => {
        if (!open || loading || tab !== 'atlassian') return
        ;(login ? secretRef.current : loginRef.current)?.focus()
    }, [loading, login, open, tab])

    const canSave =
        login.trim().length > 0 &&
        baseUrl.trim().length > 0 &&
        (!hasSecret ? secret.trim().length > 0 : true) &&
        !loading

    async function save(event?: React.FormEvent) {
        event?.preventDefault()
        if (!canSave) return
        try {
            setLoading(true)
            const next = await apiClient.saveSettings(login.trim(), secret || undefined, baseUrl.trim())
            setHasSecret(next.hasSecret)
            setSaved('ok')
            setSecret('')
        } catch {
            setSaved('err')
        } finally {
            setLoading(false)
        }
    }

    async function checkUpdates() {
        try {
            setCheckingUpdates(true)
            setUpdateError(null)
            const result = await apiClient.checkForUpdates()
            setUpdateInfo(result)
        } catch (error) {
            setUpdateError(error instanceof Error ? error.message : String(error))
        } finally {
            setCheckingUpdates(false)
        }
    }

    function openExternal(url: string | null | undefined) {
        const next = String(url ?? '').trim()
        if (!next) return
        window.open(next, '_blank', 'noopener')
    }

    const buildMode = appInfo?.isPackaged ? t('settings.buildMode.packaged') : t('settings.buildMode.dev')
    const publishedLabel = updateInfo?.publishedAt
        ? new Date(updateInfo.publishedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')
        : ''

    if (!open) return null

    return (
        <div className="settings-modal__backdrop" onMouseDown={onClose}>
            <div
                className="settings-modal"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
            >
                <div className="settings-modal__header">
                    <h3 id="settings-title" className="settings-modal__title">
                        {t('settings.title')}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="settings-modal__close"
                        title={t('settings.close')}
                    >
                        x
                    </button>
                </div>

                <div className="settings-modal__body">
                    <div className="settings-modal__sidebar">
                        <TabButton active={tab === 'atlassian'} onClick={() => setTab('atlassian')}>
                            {t('settings.tab.atlassian')}
                        </TabButton>
                        <TabButton active={tab === 'appearance'} onClick={() => setTab('appearance')}>
                            {t('settings.tab.appearance')}
                        </TabButton>
                    </div>

                    <div className="settings-modal__content">
                        <div className="settings-modal__card">
                            {tab === 'atlassian' ? (
                                loading ? (
                                    <div>{t('settings.loading')}</div>
                                ) : (
                                    <form onSubmit={save} className="settings-modal__form">
                                        <h4 className="settings-modal__section-title">{t('settings.atlassianTitle')}</h4>
                                        {saved === 'ok' ? <Alert tone="ok">{t('settings.saved')}</Alert> : null}
                                        {saved === 'err' ? <Alert tone="error">{t('settings.saveError')}</Alert> : null}

                                        <Field label={t('settings.baseUrl')}>
                                            <input
                                                value={baseUrl}
                                                onChange={(event) => setBaseUrl(event.target.value)}
                                                className="settings-modal__input"
                                                placeholder="https://jira.mycompany.com"
                                                autoComplete="url"
                                            />
                                        </Field>

                                        <Field label={t('settings.login')}>
                                            <input
                                                ref={loginRef}
                                                value={login}
                                                onChange={(event) => setLogin(event.target.value)}
                                                className="settings-modal__input"
                                                autoComplete="username"
                                            />
                                        </Field>

                                        <Field
                                            label={(
                                                <>
                                                    {t('settings.password')}
                                                    {hasSecret ? (
                                                        <span className="settings-modal__chip">
                                                            {t('settings.passwordStored')}
                                                        </span>
                                                    ) : null}
                                                </>
                                            )}
                                        >
                                            <div className="settings-modal__secret-field">
                                                <input
                                                    ref={secretRef}
                                                    value={secret}
                                                    onChange={(event) => setSecret(event.target.value)}
                                                    className="settings-modal__input"
                                                    placeholder={hasSecret ? t('settings.passwordPlaceholder') : ''}
                                                    type="password"
                                                    autoComplete="current-password"
                                                />
                                            </div>
                                        </Field>

                                        <Alert tone="info">{t('settings.securityHint')}</Alert>

                                        <div className="settings-modal__actions">
                                            <button
                                                type="submit"
                                                disabled={!canSave}
                                                className="settings-modal__button settings-modal__button--primary"
                                            >
                                                {t('settings.save')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="settings-modal__button settings-modal__button--secondary"
                                            >
                                                {t('settings.close')}
                                            </button>
                                        </div>
                                    </form>
                                )
                            ) : (
                                <div className="settings-modal__form">
                                    <h4 className="settings-modal__section-title">{t('settings.appearanceTitle')}</h4>

                                    <Field label={t('settings.language')}>
                                        <select
                                            value={locale}
                                            onChange={(event) => setLocale(event.target.value as UiLocale)}
                                            className="settings-modal__input"
                                        >
                                            <option value="ru">{t('settings.language.ru')}</option>
                                            <option value="en">{t('settings.language.en')}</option>
                                        </select>
                                        <div className="settings-modal__hint">{t('settings.languageHint')}</div>
                                    </Field>

                                    <Field label={t('settings.theme')}>
                                        <select
                                            value={themeMode}
                                            onChange={(event) => setThemeMode(event.target.value as UiThemeMode)}
                                            className="settings-modal__input"
                                        >
                                            <option value="dark">{t('settings.theme.dark')}</option>
                                            <option value="light">{t('settings.theme.light')}</option>
                                        </select>
                                        <div className="settings-modal__hint">{t('settings.themeHint')}</div>
                                    </Field>

                                    <div className="settings-modal__field">
                                        <label className="settings-modal__checkbox">
                                            <input
                                                type="checkbox"
                                                checked={jsonBeautifyTolerant}
                                                onChange={(event) => setJsonBeautifyTolerant(event.target.checked)}
                                            />
                                            <span>{t('settings.jsonBeautifyTolerant')}</span>
                                        </label>
                                        <div className="settings-modal__hint">{t('settings.jsonBeautifyTolerantHint')}</div>
                                    </div>

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
                                                onClick={checkUpdates}
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

                                    <div className="settings-modal__actions">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="settings-modal__button settings-modal__button--primary"
                                        >
                                            {t('settings.close')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <label className="settings-modal__field">
            <div className="settings-modal__label">{label}</div>
            {children}
        </label>
    )
}

function TabButton({
    active,
    children,
    onClick,
}: {
    active: boolean
    children: React.ReactNode
    onClick(): void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`settings-modal__tab${active ? ' settings-modal__tab--active' : ''}`}
        >
            {children}
        </button>
    )
}

function Alert({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
    return <div className={`settings-modal__alert settings-modal__alert--${tone}`}>{children}</div>
}
