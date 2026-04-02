import { messages } from './i18nMessages'

export type UiLocale = 'ru' | 'en'
export type UiThemeMode = 'light' | 'dark'

const LOCALE_STORAGE_KEY = 'ui.locale'
const THEME_STORAGE_KEY = 'ui.theme'

export type MessageKey = keyof typeof messages.en

export function getStoredLocale(): UiLocale {
    if (typeof window === 'undefined') return 'ru'
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return stored === 'en' || stored === 'ru' ? stored : 'ru'
}

export function getStoredThemeMode(): UiThemeMode {
    if (typeof window === 'undefined') return 'dark'
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
}

function formatMessage(template: string, params?: Record<string, string | number>) {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''))
}

export function translate(
    key: MessageKey,
    params?: Record<string, string | number>,
    locale: UiLocale = getStoredLocale()
) {
    const template = messages[locale][key] ?? messages.en[key] ?? key
    return formatMessage(template, params)
}

