const { contextBridge, ipcRenderer } = require('electron')

const CHANNELS = {
    APP_GET_INFO: 'APP_GET_INFO',
    APP_CHECK_FOR_UPDATES: 'APP_CHECK_FOR_UPDATES',
    APP_LIST_LOCAL_TREE_ICONS: 'APP_LIST_LOCAL_TREE_ICONS',
    APP_IMPORT_LOCAL_TREE_ICON: 'APP_IMPORT_LOCAL_TREE_ICON',
    APP_DELETE_LOCAL_TREE_ICON: 'APP_DELETE_LOCAL_TREE_ICON',
    LOAD_STATE: 'LOAD_STATE',
    SAVE_STATE: 'SAVE_STATE',
    LOAD_SETTINGS: 'LOAD_SETTINGS',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    STORE_WORKSPACE_ATTACHMENTS: 'STORE_WORKSPACE_ATTACHMENTS',
    OPEN_WORKSPACE_ATTACHMENT: 'OPEN_WORKSPACE_ATTACHMENT',
    SYNC_PULL_BY_LINK: 'SYNC_PULL_BY_LINK',
    SYNC_PUSH_TEST: 'SYNC_PUSH_TEST',
    SYNC_TWO_WAY_SYNC: 'SYNC_TWO_WAY_SYNC',
    SYNC_FETCH_ZEPHYR_IMPORT: 'SYNC_FETCH_ZEPHYR_IMPORT',
    SYNC_FETCH_ZEPHYR_PUBLISH: 'SYNC_FETCH_ZEPHYR_PUBLISH',
    SYNC_PUBLISH_ZEPHYR_PREVIEW: 'SYNC_PUBLISH_ZEPHYR_PREVIEW',
    WRITE_STATE_SNAPSHOT: 'WRITE_STATE_SNAPSHOT',
    WRITE_PUBLISH_LOG: 'WRITE_PUBLISH_LOG',
    APP_GET_WINDOW_ICON: 'APP_GET_WINDOW_ICON',
    APP_SET_WINDOW_ICON: 'APP_SET_WINDOW_ICON',
    APP_PICK_WINDOW_ICON: 'APP_PICK_WINDOW_ICON',
    APP_RESET_WINDOW_ICON: 'APP_RESET_WINDOW_ICON',
}

contextBridge.exposeInMainWorld('api', {
    getAppInfo: () => ipcRenderer.invoke(CHANNELS.APP_GET_INFO),
    checkForUpdates: () => ipcRenderer.invoke(CHANNELS.APP_CHECK_FOR_UPDATES),
    listLocalTreeIcons: () => ipcRenderer.invoke(CHANNELS.APP_LIST_LOCAL_TREE_ICONS),
    importLocalTreeIcon: () => ipcRenderer.invoke(CHANNELS.APP_IMPORT_LOCAL_TREE_ICON),
    deleteLocalTreeIcon: (iconKey) => ipcRenderer.invoke(CHANNELS.APP_DELETE_LOCAL_TREE_ICON, { iconKey }),
    loadState: (fallback) => ipcRenderer.invoke(CHANNELS.LOAD_STATE, fallback),
    saveState: (state) => ipcRenderer.invoke(CHANNELS.SAVE_STATE, state),
    loadSettings: () => ipcRenderer.invoke(CHANNELS.LOAD_SETTINGS),
    saveSettings: (login, passwordOrToken, baseUrl) =>
        ipcRenderer.invoke(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }),
    storeWorkspaceAttachments: (files) =>
        ipcRenderer.invoke(CHANNELS.STORE_WORKSPACE_ATTACHMENTS, { files }),
    openWorkspaceAttachment: (ref) =>
        ipcRenderer.invoke(CHANNELS.OPEN_WORKSPACE_ATTACHMENT, { ref }),
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
    getWindowIcon: () => ipcRenderer.invoke(CHANNELS.APP_GET_WINDOW_ICON),
    setWindowIcon: (pngBytes) => ipcRenderer.invoke(CHANNELS.APP_SET_WINDOW_ICON, { pngBytes }),
    pickWindowIcon: () => ipcRenderer.invoke(CHANNELS.APP_PICK_WINDOW_ICON),
    resetWindowIcon: () => ipcRenderer.invoke(CHANNELS.APP_RESET_WINDOW_ICON),
})
