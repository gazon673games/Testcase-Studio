import type { IpcMain } from 'electron'
import { CHANNELS } from './channels.js'
import type { RootState } from '@core/domain'
import { loadFromFs, saveToFs } from '../../electron/repo.js'
import { loadSettings as loadUserSettings, saveSettings as saveUserSettings } from '../../electron/secureSettings.js'


export function registerHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_STATE, async (_e, fallback) => {
        try { return await loadFromFs() } catch { return fallback }
    })
    ipcMain.handle(CHANNELS.SAVE_STATE, async (_e, state) => {
        await saveToFs(state); return true
    })

    ipcMain.handle(CHANNELS.LOAD_SETTINGS, async () => {
        return await loadUserSettings()
    })
    ipcMain.handle(CHANNELS.SAVE_SETTINGS, async (_e, payload: { email: string, passwordOrToken?: string }) => {
        return await saveUserSettings(payload.email, payload.passwordOrToken)
    })
}