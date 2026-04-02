import type { IpcMain } from 'electron'
import type { RootState, TestCase, TestCaseLink } from '../core/domain.js'
import type { ZephyrImportRequest, ZephyrPublishPreview } from '../application/sync/index.js'
import { loadFromFs, saveToFs, writePublishLog, writeStateSnapshot } from '../../electron/repo.js'
import { CHANNELS } from './channels.js'
import { loadMainSettings, saveMainSettings } from './handlerSettings.js'
import {
    fetchZephyrImportInMain,
    fetchZephyrPublishInMain,
    publishZephyrPreviewInMain,
    pullByLinkInMain,
    pushTestInMain,
    twoWaySyncStateInMain,
} from './handlerSync.js'

export function registerPersistenceHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_STATE, async () => {
        return await loadFromFs()
    })

    ipcMain.handle(CHANNELS.SAVE_STATE, async (_event, state: RootState) => {
        await saveToFs(state)
        return true
    })

    ipcMain.handle(
        CHANNELS.WRITE_STATE_SNAPSHOT,
        async (_event, payload: { state: RootState; kind?: string; meta?: Record<string, unknown> }) => {
            return await writeStateSnapshot(payload.state, payload.kind, payload.meta)
        }
    )

    ipcMain.handle(CHANNELS.WRITE_PUBLISH_LOG, async (_event, payload: Record<string, unknown>) => {
        return await writePublishLog(payload)
    })
}

export function registerSettingsHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_SETTINGS, async () => {
        return await loadMainSettings()
    })

    ipcMain.handle(
        CHANNELS.SAVE_SETTINGS,
        async (_event, payload: { login: string; passwordOrToken?: string; baseUrl?: string }) => {
            return await saveMainSettings(payload)
        }
    )
}

export function registerSyncHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.SYNC_PULL_BY_LINK, async (_event, payload: { link: TestCaseLink }) => {
        return await pullByLinkInMain(payload.link)
    })

    ipcMain.handle(
        CHANNELS.SYNC_PUSH_TEST,
        async (_event, payload: { test: TestCase; link: TestCaseLink; state?: RootState }) => {
            return await pushTestInMain(payload.test, payload.link, payload.state)
        }
    )

    ipcMain.handle(CHANNELS.SYNC_TWO_WAY_SYNC, async (_event, payload: { state: RootState }) => {
        return await twoWaySyncStateInMain(payload.state)
    })

    ipcMain.handle(
        CHANNELS.SYNC_FETCH_ZEPHYR_IMPORT,
        async (_event, payload: { request: ZephyrImportRequest }) => {
            return await fetchZephyrImportInMain(payload.request)
        }
    )

    ipcMain.handle(
        CHANNELS.SYNC_FETCH_ZEPHYR_PUBLISH,
        async (_event, payload: { externalIds: string[] }) => {
            return await fetchZephyrPublishInMain(payload.externalIds)
        }
    )

    ipcMain.handle(
        CHANNELS.SYNC_PUBLISH_ZEPHYR_PREVIEW,
        async (_event, payload: { state: RootState; preview: ZephyrPublishPreview }) => {
            return await publishZephyrPreviewInMain(payload.state, payload.preview)
        }
    )
}
