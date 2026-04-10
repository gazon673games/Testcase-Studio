import * as React from 'react'
import { useUiPreferences, type UiLocale, type UiThemeMode } from '../preferences'
import { AtlassianSettingsPanel } from './AtlassianSettingsPanel'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { TabButton } from './SettingsShared'
import { useSettingsModalState } from './useSettingsModalState'
import './Settings.css'

type Props = { open: boolean; onClose(): void }

const TABS = ['atlassian', 'appearance'] as const
type TabKey = typeof TABS[number]

export function SettingsModal({ open, onClose }: Props) {
    const { locale, setLocale, themeMode, setThemeMode, jsonBeautifyTolerant, setJsonBeautifyTolerant, t } = useUiPreferences()
    const [tab, setTab] = React.useState<TabKey>('atlassian')
    const state = useSettingsModalState(open)

    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    React.useEffect(() => {
        if (!open || state.loading || tab !== 'atlassian') return
        ;(state.login ? state.secretRef.current : state.loginRef.current)?.focus()
    }, [open, state.loading, state.login, state.loginRef, state.secretRef, tab])

    const canSave =
        state.login.trim().length > 0 &&
        state.baseUrl.trim().length > 0 &&
        (!state.hasSecret ? state.secret.trim().length > 0 : true) &&
        !state.loading

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
                                <AtlassianSettingsPanel
                                    loading={state.loading}
                                    login={state.login}
                                    baseUrl={state.baseUrl}
                                    secret={state.secret}
                                    hasSecret={state.hasSecret}
                                    saved={state.saved}
                                    canSave={canSave}
                                    loginRef={state.loginRef}
                                    secretRef={state.secretRef}
                                    t={t}
                                    onChangeLogin={state.setLogin}
                                    onChangeBaseUrl={state.setBaseUrl}
                                    onChangeSecret={state.setSecret}
                                    onSave={(event) => void state.save(canSave, event)}
                                    onClose={onClose}
                                />
                            ) : (
                                <AppearanceSettingsPanel
                                    locale={locale}
                                    themeMode={themeMode}
                                    jsonBeautifyTolerant={jsonBeautifyTolerant}
                                    appInfo={state.appInfo}
                                    updateInfo={state.updateInfo}
                                    updateError={state.updateError}
                                    checkingUpdates={state.checkingUpdates}
                                    t={t}
                                    onSetLocale={(value) => setLocale(value as UiLocale)}
                                    onSetThemeMode={(value) => setThemeMode(value as UiThemeMode)}
                                    onSetJsonBeautifyTolerant={setJsonBeautifyTolerant}
                                    onCheckUpdates={() => void state.checkUpdates()}
                                    onClose={onClose}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
