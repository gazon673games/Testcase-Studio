import { CHANNELS } from './channels'
import type { AtlassianSettings } from '@core/settings'

export const apiClient = {
    loadState: <T>(fallback: T) => window.api.invoke<T>(CHANNELS.LOAD_STATE, fallback),
    saveState:  <T>(state: T)   => window.api.invoke<void>(CHANNELS.SAVE_STATE, state),

    loadSettings: () => window.api.invoke<AtlassianSettings>(CHANNELS.LOAD_SETTINGS),

    // passwordOrToken опционален: если пустая строка/undefined — секрет не меняем
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        window.api.invoke<AtlassianSettings>(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }),

    // 👇 для показа пароля: тянем секрет из keychain по запросу
    getAtlassianSecret: (login: string) =>
        window.api.invoke<string>(CHANNELS.GET_ATLASSIAN_SECRET, { login }),
}
