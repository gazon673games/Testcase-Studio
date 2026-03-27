import * as React from 'react'
import { apiClient } from '@ipc/client'
import type { AtlassianSettings } from '@core/settings'
import { useUiPreferences, type UiLocale, type UiThemeMode } from './preferences'

type Props = { open: boolean; onClose(): void }

const TABS = ['atlassian', 'appearance'] as const
type TabKey = typeof TABS[number]

export function SettingsModal({ open, onClose }: Props) {
    const { locale, setLocale, themeMode, setThemeMode, t } = useUiPreferences()
    const [tab, setTab] = React.useState<TabKey>('atlassian')
    const [loading, setLoading] = React.useState(true)
    const [login, setLogin] = React.useState('')
    const [baseUrl, setBaseUrl] = React.useState('')
    const [secret, setSecret] = React.useState('')
    const [hasSecret, setHasSecret] = React.useState(false)
    const [saved, setSaved] = React.useState<'idle' | 'ok' | 'err'>('idle')
    const [showSecret, setShowSecret] = React.useState(false)
    const loginRef = React.useRef<HTMLInputElement | null>(null)
    const secretRef = React.useRef<HTMLInputElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        setLoading(true)
        setSaved('idle')
        setSecret('')
        setShowSecret(false)
        apiClient.loadSettings()
            .then((settings: AtlassianSettings) => {
                setLogin(settings.login ?? '')
                setBaseUrl(settings.baseUrl ?? '')
                setHasSecret(settings.hasSecret)
            })
            .finally(() => setLoading(false))
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
            setShowSecret(false)
        } catch {
            setSaved('err')
        } finally {
            setLoading(false)
        }
    }

    async function toggleShowSecret() {
        const next = !showSecret
        if (next && hasSecret && !secret && login.trim()) {
            try {
                const fromStore = await apiClient.getAtlassianSecret(login.trim())
                setSecret(fromStore || '')
            } catch {
                // best effort only
            }
        }
        setShowSecret(next)
    }

    if (!open) return null

    return (
        <div style={backdropStyle} onMouseDown={onClose}>
            <div
                style={modalStyle}
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
            >
                <div style={headerStyle}>
                    <h3 id="settings-title" style={{ margin: 0 }}>{t('settings.title')}</h3>
                    <button type="button" onClick={onClose} style={closeButtonStyle} title={t('settings.close')}>
                        x
                    </button>
                </div>

                <div style={bodyStyle}>
                    <div style={sidebarStyle}>
                        <TabButton active={tab === 'atlassian'} onClick={() => setTab('atlassian')}>
                            {t('settings.tab.atlassian')}
                        </TabButton>
                        <TabButton active={tab === 'appearance'} onClick={() => setTab('appearance')}>
                            {t('settings.tab.appearance')}
                        </TabButton>
                    </div>

                    <div style={contentAreaStyle}>
                        <div style={cardStyle}>
                            {tab === 'atlassian' ? (
                                loading ? (
                                    <div>{t('settings.loading')}</div>
                                ) : (
                                    <form onSubmit={save} style={formStyle}>
                                        <h4 style={sectionTitleStyle}>{t('settings.atlassianTitle')}</h4>
                                        {saved === 'ok' ? <Alert tone="ok">{t('settings.saved')}</Alert> : null}
                                        {saved === 'err' ? <Alert tone="error">{t('settings.saveError')}</Alert> : null}

                                        <Field label={t('settings.baseUrl')}>
                                            <input
                                                value={baseUrl}
                                                onChange={(event) => setBaseUrl(event.target.value)}
                                                style={inputStyle}
                                                placeholder="https://jira.mycompany.com"
                                                autoComplete="url"
                                            />
                                        </Field>

                                        <Field label={t('settings.login')}>
                                            <input
                                                ref={loginRef}
                                                value={login}
                                                onChange={(event) => setLogin(event.target.value)}
                                                style={inputStyle}
                                                autoComplete="username"
                                            />
                                        </Field>

                                        <Field
                                            label={(
                                                <>
                                                    {t('settings.password')}
                                                    {hasSecret ? <span style={chipStyle}>{t('settings.passwordStored')}</span> : null}
                                                </>
                                            )}
                                        >
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    ref={secretRef}
                                                    value={secret}
                                                    onChange={(event) => setSecret(event.target.value)}
                                                    style={inputStyle}
                                                    placeholder={hasSecret ? t('settings.passwordPlaceholder') : ''}
                                                    type={showSecret ? 'text' : 'password'}
                                                    autoComplete="current-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={toggleShowSecret}
                                                    style={eyeButtonStyle}
                                                    aria-label={showSecret ? t('settings.hide') : t('settings.show')}
                                                    title={showSecret ? t('settings.hidePassword') : t('settings.showPassword')}
                                                >
                                                    {showSecret ? t('settings.hide') : t('settings.show')}
                                                </button>
                                            </div>
                                        </Field>

                                        <Alert tone="info">{t('settings.securityHint')}</Alert>

                                        <div style={actionRowStyle}>
                                            <button type="submit" disabled={!canSave} style={{ ...primaryButtonStyle, opacity: canSave ? 1 : 0.6 }}>
                                                {t('settings.save')}
                                            </button>
                                            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
                                                {t('settings.close')}
                                            </button>
                                        </div>
                                    </form>
                                )
                            ) : (
                                <div style={formStyle}>
                                    <h4 style={sectionTitleStyle}>{t('settings.appearanceTitle')}</h4>

                                    <Field label={t('settings.language')}>
                                        <select
                                            value={locale}
                                            onChange={(event) => setLocale(event.target.value as UiLocale)}
                                            style={inputStyle}
                                        >
                                            <option value="ru">{t('settings.language.ru')}</option>
                                            <option value="en">{t('settings.language.en')}</option>
                                        </select>
                                        <div style={hintStyle}>{t('settings.languageHint')}</div>
                                    </Field>

                                    <Field label={t('settings.theme')}>
                                        <select
                                            value={themeMode}
                                            onChange={(event) => setThemeMode(event.target.value as UiThemeMode)}
                                            style={inputStyle}
                                        >
                                            <option value="dark">{t('settings.theme.dark')}</option>
                                            <option value="light">{t('settings.theme.light')}</option>
                                        </select>
                                        <div style={hintStyle}>{t('settings.themeHint')}</div>
                                    </Field>

                                    <div style={actionRowStyle}>
                                        <button type="button" onClick={onClose} style={primaryButtonStyle}>
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
        <label style={fieldStyle}>
            <div style={labelStyle}>{label}</div>
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
        <button type="button" onClick={onClick} style={{ ...tabButtonStyle, ...(active ? tabButtonActiveStyle : null) }}>
            {children}
        </button>
    )
}

function Alert({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
    const styles =
        tone === 'ok'
            ? { background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }
            : tone === 'error'
                ? { background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }
                : { background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info-text)' }

    return <div style={{ ...alertStyle, ...styles }}>{children}</div>
}

const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'var(--bg-overlay-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
}

const modalStyle: React.CSSProperties = {
    width: 'min(960px, 86vw)',
    height: 'min(760px, 80vh)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-strong)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: 'var(--text)',
}

const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-soft)',
    display: 'flex',
    alignItems: 'center',
}

const closeButtonStyle: React.CSSProperties = {
    marginLeft: 'auto',
    border: '1px solid var(--border)',
    background: 'var(--bg-soft)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '6px 10px',
    cursor: 'pointer',
}

const bodyStyle: React.CSSProperties = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    minHeight: 0,
}

const sidebarStyle: React.CSSProperties = {
    borderRight: '1px solid var(--border-soft)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: 'var(--bg-soft)',
}

const tabButtonStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    fontWeight: 600,
}

const tabButtonActiveStyle: React.CSSProperties = {
    background: 'var(--accent-bg)',
    borderColor: 'var(--accent-border)',
    color: 'var(--accent-text)',
}

const contentAreaStyle: React.CSSProperties = {
    padding: 20,
    overflow: 'auto',
    background: 'var(--bg)',
}

const cardStyle: React.CSSProperties = {
    maxWidth: 820,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-soft)',
}

const formStyle: React.CSSProperties = {
    display: 'grid',
    gap: 14,
}

const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
}

const fieldStyle: React.CSSProperties = {
    display: 'grid',
    gap: 6,
}

const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    outline: 'none',
}

const hintStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--text-muted)',
}

const chipStyle: React.CSSProperties = {
    marginLeft: 8,
    color: 'var(--success-text)',
    background: 'var(--success-bg)',
    border: '1px solid var(--success-border)',
    padding: '0 6px',
    borderRadius: 999,
    fontSize: 12,
}

const eyeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
}

const alertStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 1.5,
}

const actionRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
}

const primaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent-text)',
    borderRadius: 10,
    padding: '9px 14px',
    fontWeight: 700,
    cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    borderRadius: 10,
    padding: '9px 14px',
    fontWeight: 600,
    cursor: 'pointer',
}
