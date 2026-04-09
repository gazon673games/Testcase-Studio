import type {
    Attachment,
    RootState,
    TestCase,
    TestCaseLink,
} from '@core/domain'
import type { AtlassianSettings } from '@core/settings'
import type {
    SyncFetchZephyrImportResponse,
    SyncFetchZephyrPublishEntry,
    SyncPublishZephyrPreviewResponse,
    ZephyrImportRequest,
    ZephyrPublishPreview,
} from '@app/sync'
import type { ProviderTest } from '@providers/types'
import type { AppInfo, AppUpdateCheckResult } from '@shared/appUpdates'
import type { LocalTreeIconOption } from '@shared/treeIcons'

function requireApiMethod<K extends keyof Window['api']>(method: K): NonNullable<Window['api'][K]> {
    const candidate = window.api?.[method]
    if (typeof candidate === 'function') return candidate as NonNullable<Window['api'][K]>
    throw new Error('Перезапустите приложение, чтобы загрузить обновлённый desktop bridge.')
}

export const apiClient = {
    getAppInfo: (): Promise<AppInfo> => requireApiMethod('getAppInfo')(),
    checkForUpdates: (): Promise<AppUpdateCheckResult> => requireApiMethod('checkForUpdates')(),
    listLocalTreeIcons: (): Promise<LocalTreeIconOption[]> => requireApiMethod('listLocalTreeIcons')(),
    importLocalTreeIcon: (): Promise<LocalTreeIconOption | null> => requireApiMethod('importLocalTreeIcon')(),
    deleteLocalTreeIcon: (iconKey: string): Promise<boolean> => requireApiMethod('deleteLocalTreeIcon')(iconKey),
    loadState: <T>(fallback: T) => window.api.loadState<T>(fallback),
    saveState: <T>(state: T) => window.api.saveState<T>(state),

    loadSettings: (): Promise<AtlassianSettings> => window.api.loadSettings(),
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        window.api.saveSettings(login, passwordOrToken, baseUrl),

    storeWorkspaceAttachments: (files: Array<{ name: string; bytes: ArrayBuffer }>): Promise<Attachment[]> =>
        window.api.storeWorkspaceAttachments(files),

    openWorkspaceAttachment: (ref: string): Promise<boolean> =>
        window.api.openWorkspaceAttachment(ref),

    syncPullByLink: (link: TestCaseLink): Promise<ProviderTest> =>
        window.api.syncPullByLink(link),

    syncPushTest: (test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }> =>
        window.api.syncPushTest(test, link, state),

    syncTwoWaySync: (state: RootState): Promise<RootState> =>
        window.api.syncTwoWaySync(state),

    syncFetchZephyrImport: (request: ZephyrImportRequest): Promise<SyncFetchZephyrImportResponse> =>
        window.api.syncFetchZephyrImport(request),

    syncFetchZephyrPublish: (externalIds: string[]): Promise<SyncFetchZephyrPublishEntry[]> =>
        window.api.syncFetchZephyrPublish(externalIds),

    syncPublishZephyrPreview: (
        state: RootState,
        preview: ZephyrPublishPreview
    ): Promise<SyncPublishZephyrPreviewResponse> =>
        window.api.syncPublishZephyrPreview(state, preview),

    writeStateSnapshot: (state: RootState, kind = 'snapshot', meta?: Record<string, unknown>) =>
        window.api.writeStateSnapshot(state, kind, meta),

    writePublishLog: (payload: Record<string, unknown>) =>
        window.api.writePublishLog(payload),
}
