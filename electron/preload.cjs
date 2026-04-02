const { contextBridge, ipcRenderer } = require('electron')

const CHANNELS = {
    LOAD_STATE: 'LOAD_STATE',
    SAVE_STATE: 'SAVE_STATE',
    LOAD_SETTINGS: 'LOAD_SETTINGS',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    SYNC_PULL_BY_LINK: 'SYNC_PULL_BY_LINK',
    SYNC_PUSH_TEST: 'SYNC_PUSH_TEST',
    SYNC_TWO_WAY_SYNC: 'SYNC_TWO_WAY_SYNC',
    SYNC_FETCH_ZEPHYR_IMPORT: 'SYNC_FETCH_ZEPHYR_IMPORT',
    SYNC_FETCH_ZEPHYR_PUBLISH: 'SYNC_FETCH_ZEPHYR_PUBLISH',
    SYNC_PUBLISH_ZEPHYR_PREVIEW: 'SYNC_PUBLISH_ZEPHYR_PREVIEW',
    WRITE_STATE_SNAPSHOT: 'WRITE_STATE_SNAPSHOT',
    WRITE_PUBLISH_LOG: 'WRITE_PUBLISH_LOG',
}

contextBridge.exposeInMainWorld('api', {
    loadState: (fallback) => ipcRenderer.invoke(CHANNELS.LOAD_STATE, fallback),
    saveState: (state) => ipcRenderer.invoke(CHANNELS.SAVE_STATE, state),
    loadSettings: () => ipcRenderer.invoke(CHANNELS.LOAD_SETTINGS),
    saveSettings: (login, passwordOrToken, baseUrl) =>
        ipcRenderer.invoke(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }),
    syncPullByLink: (link) => ipcRenderer.invoke(CHANNELS.SYNC_PULL_BY_LINK, { link }),
    syncPushTest: (test, link, state) => ipcRenderer.invoke(CHANNELS.SYNC_PUSH_TEST, { test, link, state }),
    syncTwoWaySync: (state) => ipcRenderer.invoke(CHANNELS.SYNC_TWO_WAY_SYNC, { state }),
    syncFetchZephyrImport: (request) => ipcRenderer.invoke(CHANNELS.SYNC_FETCH_ZEPHYR_IMPORT, { request }),
    syncFetchZephyrPublish: (externalIds) => ipcRenderer.invoke(CHANNELS.SYNC_FETCH_ZEPHYR_PUBLISH, { externalIds }),
    syncPublishZephyrPreview: (state, preview) =>
        ipcRenderer.invoke(CHANNELS.SYNC_PUBLISH_ZEPHYR_PREVIEW, { state, preview }),
    writeStateSnapshot: (state, kind = 'snapshot', meta) =>
        ipcRenderer.invoke(CHANNELS.WRITE_STATE_SNAPSHOT, { state, kind, meta }),
    writePublishLog: (payload) => ipcRenderer.invoke(CHANNELS.WRITE_PUBLISH_LOG, payload),
})
