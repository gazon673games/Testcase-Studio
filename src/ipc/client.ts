import { CHANNELS } from './channels'
import type { AtlassianSettings } from '@core/settings'

export const apiClient = {
    loadState: <T>(fallback: T) => window.api.invoke<T>(CHANNELS.LOAD_STATE, fallback),
    saveState:  <T>(state: T)   => window.api.invoke<void>(CHANNELS.SAVE_STATE, state),

    loadSettings: () => window.api.invoke<AtlassianSettings>(CHANNELS.LOAD_SETTINGS),
    // passwordOrToken опционален: если пустая строка/undefined — секрет не меняем
    saveSettings: (email: string, passwordOrToken?: string) =>
        window.api.invoke<AtlassianSettings>(CHANNELS.SAVE_SETTINGS, { email, passwordOrToken })
}