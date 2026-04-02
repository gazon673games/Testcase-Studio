import type { IpcMain } from 'electron'
import { registerPersistenceHandlers, registerSettingsHandlers, registerSyncHandlers } from './handlerRegistration.js'

export function registerHandlers(ipcMain: IpcMain) {
    registerPersistenceHandlers(ipcMain)
    registerSettingsHandlers(ipcMain)
    registerSyncHandlers(ipcMain)
}
