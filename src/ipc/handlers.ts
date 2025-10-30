import type { IpcMain } from 'electron'
import { CHANNELS } from './channels.js'
import type { RootState } from '@core/domain'
import { loadFromFs, saveToFs } from '../../electron/repo.js'
import {
    loadSettings as loadUserSettings,
    saveSettings as saveUserSettings,
    getAtlassianSecret as getSecretMain
} from '../../electron/secureSettings.js'

export function registerHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_STATE, async (_e, fallback) => {
        try { return await loadFromFs() } catch { return fallback }
    })
    ipcMain.handle(CHANNELS.SAVE_STATE, async (_e, state: RootState) => {
        await saveToFs(state); return true
    })

    ipcMain.handle(CHANNELS.LOAD_SETTINGS, async () => {
        return await loadUserSettings()
    })

    ipcMain.handle(
        CHANNELS.SAVE_SETTINGS,
        async (_e, payload: { login: string; passwordOrToken?: string; baseUrl?: string }) => {
            return await saveUserSettings(payload.login, payload.passwordOrToken, payload.baseUrl)
        }
    )

    ipcMain.handle(
        CHANNELS.GET_ATLASSIAN_SECRET,
        async (_e, payload: { login: string }) => {
            const s = await getSecretMain(payload.login)
            return s ?? ''
        }
    )
}
