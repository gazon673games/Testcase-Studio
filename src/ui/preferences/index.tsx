import * as React from 'react'
import {
    getStoredLocale,
    getStoredThemeMode,
    translate,
    type MessageKey,
    type UiLocale,
    type UiThemeMode,
} from '@shared/i18n'
import { getStoredJsonBeautifyTolerant, setStoredJsonBeautifyTolerant } from '@shared/uiPreferences'

export type { MessageKey, UiLocale, UiThemeMode } from '@shared/i18n'

type PreferencesContextValue = {
    locale: UiLocale
    setLocale(locale: UiLocale): void
    themeMode: UiThemeMode
    setThemeMode(mode: UiThemeMode): void
    jsonBeautifyTolerant: boolean
    setJsonBeautifyTolerant(enabled: boolean): void
    t(key: MessageKey, params?: Record<string, string | number>): string
}

const PreferencesContext = React.createContext<PreferencesContextValue | null>(null)

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = React.useState<UiLocale>(() => getStoredLocale())
    const [themeMode, setThemeModeState] = React.useState<UiThemeMode>(() => getStoredThemeMode())
    const [jsonBeautifyTolerant, setJsonBeautifyTolerantState] = React.useState<boolean>(() => getStoredJsonBeautifyTolerant())

    React.useEffect(() => {
        document.documentElement.lang = locale
        document.documentElement.dataset.theme = themeMode
        window.localStorage.setItem('ui.locale', locale)
        window.localStorage.setItem('ui.theme', themeMode)
        setStoredJsonBeautifyTolerant(jsonBeautifyTolerant)
    }, [jsonBeautifyTolerant, locale, themeMode])

    const value = React.useMemo<PreferencesContextValue>(
        () => ({
            locale,
            setLocale: setLocaleState,
            themeMode,
            setThemeMode: setThemeModeState,
            jsonBeautifyTolerant,
            setJsonBeautifyTolerant: setJsonBeautifyTolerantState,
            t: (key, params) => translate(key, params, locale),
        }),
        [jsonBeautifyTolerant, locale, themeMode]
    )

    return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function useUiPreferences() {
    const context = React.useContext(PreferencesContext)
    if (!context) throw new Error('useUiPreferences must be used within <UiPreferencesProvider/>')
    return context
}

export { getStoredLocale, getStoredThemeMode, translate }
