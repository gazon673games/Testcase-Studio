const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

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
} as const

contextBridge.exposeInMainWorld('api', {
    loadState: <T,>(fallback: T) => ipcRenderer.invoke(CHANNELS.LOAD_STATE, fallback) as Promise<T>,
    saveState: <T,>(state: T) => ipcRenderer.invoke(CHANNELS.SAVE_STATE, state) as Promise<void>,
    loadSettings: () => ipcRenderer.invoke(CHANNELS.LOAD_SETTINGS) as Promise<import('../src/core/settings').AtlassianSettings>,
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        ipcRenderer.invoke(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }) as Promise<import('../src/core/settings').AtlassianSettings>,
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
})
