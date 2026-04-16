const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

const CHANNELS = {
    APP_GET_INFO: 'APP_GET_INFO',
    APP_CHECK_FOR_UPDATES: 'APP_CHECK_FOR_UPDATES',
    APP_LIST_LOCAL_TREE_ICONS: 'APP_LIST_LOCAL_TREE_ICONS',
    APP_IMPORT_LOCAL_TREE_ICON: 'APP_IMPORT_LOCAL_TREE_ICON',
    APP_DELETE_LOCAL_TREE_ICON: 'APP_DELETE_LOCAL_TREE_ICON',
    APP_GET_WINDOW_ICON: 'APP_GET_WINDOW_ICON',
    APP_SET_WINDOW_ICON: 'APP_SET_WINDOW_ICON',
    APP_PICK_WINDOW_ICON: 'APP_PICK_WINDOW_ICON',
    APP_RESET_WINDOW_ICON: 'APP_RESET_WINDOW_ICON',
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
} as const

contextBridge.exposeInMainWorld('api', {
    getAppInfo: () => ipcRenderer.invoke(CHANNELS.APP_GET_INFO) as Promise<import('../src/shared/appUpdates').AppInfo>,
    checkForUpdates: () =>
        ipcRenderer.invoke(CHANNELS.APP_CHECK_FOR_UPDATES) as Promise<import('../src/shared/appUpdates').AppUpdateCheckResult>,
    listLocalTreeIcons: () =>
        ipcRenderer.invoke(CHANNELS.APP_LIST_LOCAL_TREE_ICONS) as Promise<import('../src/shared/treeIcons').LocalTreeIconOption[]>,
    importLocalTreeIcon: () =>
        ipcRenderer.invoke(CHANNELS.APP_IMPORT_LOCAL_TREE_ICON) as Promise<import('../src/shared/treeIcons').LocalTreeIconOption | null>,
    deleteLocalTreeIcon: (iconKey: string) =>
        ipcRenderer.invoke(CHANNELS.APP_DELETE_LOCAL_TREE_ICON, { iconKey }) as Promise<boolean>,
    loadState: <T,>(fallback: T) => ipcRenderer.invoke(CHANNELS.LOAD_STATE, fallback) as Promise<T>,
    saveState: <T,>(state: T) => ipcRenderer.invoke(CHANNELS.SAVE_STATE, state) as Promise<void>,
    loadSettings: () => ipcRenderer.invoke(CHANNELS.LOAD_SETTINGS) as Promise<import('../src/core/settings').AtlassianSettings>,
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        ipcRenderer.invoke(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }) as Promise<import('../src/core/settings').AtlassianSettings>,
    storeWorkspaceAttachments: (files: Array<{ name: string; bytes: ArrayBuffer }>) =>
        ipcRenderer.invoke(CHANNELS.STORE_WORKSPACE_ATTACHMENTS, { files }) as Promise<import('../src/core/domain').Attachment[]>,
    openWorkspaceAttachment: (ref: string) =>
        ipcRenderer.invoke(CHANNELS.OPEN_WORKSPACE_ATTACHMENT, { ref }) as Promise<boolean>,
    syncPullByLink: (link: import('../src/core/domain').TestCaseLink) =>
        ipcRenderer.invoke(CHANNELS.SYNC_PULL_BY_LINK, { link }) as Promise<import('../src/providers/types').ProviderTest>,
    syncPushTest: (
        test: import('../src/core/domain').TestCase,
        link: import('../src/core/domain').TestCaseLink,
        state?: import('../src/core/domain').RootState
    ) => ipcRenderer.invoke(CHANNELS.SYNC_PUSH_TEST, { test, link, state }) as Promise<{ externalId: string }>,
    syncTwoWaySync: (state: import('../src/core/domain').RootState) =>
        ipcRenderer.invoke(CHANNELS.SYNC_TWO_WAY_SYNC, { state }) as Promise<import('../src/core/domain').RootState>,
    syncFetchZephyrImport: (request: import('../src/application/sync').ZephyrImportRequest) =>
        ipcRenderer.invoke(CHANNELS.SYNC_FETCH_ZEPHYR_IMPORT, { request }) as Promise<import('../src/application/sync').SyncFetchZephyrImportResponse>,
    syncFetchZephyrPublish: (externalIds: string[]) =>
        ipcRenderer.invoke(CHANNELS.SYNC_FETCH_ZEPHYR_PUBLISH, { externalIds }) as Promise<import('../src/application/sync').SyncFetchZephyrPublishEntry[]>,
    syncPublishZephyrPreview: (
        state: import('../src/core/domain').RootState,
        preview: import('../src/application/sync').ZephyrPublishPreview
    ) =>
        ipcRenderer.invoke(CHANNELS.SYNC_PUBLISH_ZEPHYR_PREVIEW, { state, preview }) as Promise<
            import('../src/application/sync').SyncPublishZephyrPreviewResponse
        >,
    writeStateSnapshot: (state: import('../src/core/domain').RootState, kind = 'snapshot', meta?: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.WRITE_STATE_SNAPSHOT, { state, kind, meta }) as Promise<string>,
    writePublishLog: (payload: Record<string, unknown>) =>
        ipcRenderer.invoke(CHANNELS.WRITE_PUBLISH_LOG, payload) as Promise<string>,
    getWindowIcon: () =>
        ipcRenderer.invoke(CHANNELS.APP_GET_WINDOW_ICON) as Promise<string | null>,
    setWindowIcon: (pngBytes: ArrayBuffer) =>
        ipcRenderer.invoke(CHANNELS.APP_SET_WINDOW_ICON, { pngBytes }) as Promise<string>,
    pickWindowIcon: () =>
        ipcRenderer.invoke(CHANNELS.APP_PICK_WINDOW_ICON) as Promise<string | null>,
    resetWindowIcon: () =>
        ipcRenderer.invoke(CHANNELS.APP_RESET_WINDOW_ICON) as Promise<void>,
})
