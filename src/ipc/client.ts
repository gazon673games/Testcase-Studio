// src/ipc/client.ts
import { CHANNELS } from './channels'
import type { AtlassianSettings } from '@core/settings'

export const apiClient = {
    loadState: <T>(fallback: T) => window.api.invoke<T>(CHANNELS.LOAD_STATE, fallback),
    saveState:  <T>(state: T)   => window.api.invoke<void>(CHANNELS.SAVE_STATE, state),

    loadSettings: () => window.api.invoke<AtlassianSettings>(CHANNELS.LOAD_SETTINGS),
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        window.api.invoke<AtlassianSettings>(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }),

    getAtlassianSecret: (login: string) =>
        window.api.invoke<string>(CHANNELS.GET_ATLASSIAN_SECRET, { login }),

    // ⬇️ теперь указываем, чем является ссылка: id | key
    zephyrGetTestCase: (ref: string, by: 'id' | 'key') =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_GET_TESTCASE, { ref, by }),
}
