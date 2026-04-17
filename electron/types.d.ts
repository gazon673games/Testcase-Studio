export {}

declare global {
    interface Window {
        api: {
            getAppInfo(): Promise<import('../src/shared/appUpdates').AppInfo>
            checkForUpdates(): Promise<import('../src/shared/appUpdates').AppUpdateCheckResult>
            listLocalTreeIcons(): Promise<import('../src/shared/treeIcons').LocalTreeIconOption[]>
            importLocalTreeIcon(): Promise<import('../src/shared/treeIcons').LocalTreeIconOption | null>
            deleteLocalTreeIcon(iconKey: string): Promise<boolean>
            loadState<T>(fallback: T): Promise<T>
            saveState<T>(state: T): Promise<void>
            loadSettings(): Promise<import('../src/core/settings').AtlassianSettings>
            saveSettings(
                login: string,
                passwordOrToken?: string,
                baseUrl?: string
            ): Promise<import('../src/core/settings').AtlassianSettings>
            storeWorkspaceAttachments(
                files: Array<{ name: string; bytes: ArrayBuffer }>
            ): Promise<import('../src/core/domain').Attachment[]>
            openWorkspaceAttachment(ref: string): Promise<boolean>
            syncPullByLink(link: import('../src/core/domain').TestCaseLink): Promise<import('../src/providers/types').ProviderTest>
            syncPushTest(
                test: import('../src/core/domain').TestCase,
                link: import('../src/core/domain').TestCaseLink,
                state?: import('../src/core/domain').RootState
            ): Promise<{ externalId: string }>
            syncTwoWaySync(state: import('../src/core/domain').RootState): Promise<import('../src/core/domain').RootState>
            syncFetchZephyrImport(
                request: import('../src/application/sync').ZephyrImportRequest
            ): Promise<import('../src/application/sync').SyncFetchZephyrImportResponse>
            syncFetchZephyrPublish(
                externalIds: string[]
            ): Promise<import('../src/application/sync').SyncFetchZephyrPublishEntry[]>
            syncPublishZephyrPreview(
                state: import('../src/core/domain').RootState,
                preview: import('../src/application/sync').ZephyrPublishPreview
            ): Promise<import('../src/application/sync').SyncPublishZephyrPreviewResponse>
            writeStateSnapshot(
                state: import('../src/core/domain').RootState,
                kind?: string,
                meta?: Record<string, unknown>
            ): Promise<string>
            writePublishLog(payload: Record<string, unknown>): Promise<string>
        }
    }
}
