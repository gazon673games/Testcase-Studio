// src/ipc/client.ts
import { CHANNELS } from './channels'
import type { RootState } from '@core/domain'
import type { AtlassianSettings } from '@core/settings'

export const apiClient = {
    loadState: <T>(fallback: T) => window.api.invoke<T>(CHANNELS.LOAD_STATE, fallback),
    saveState:  <T>(state: T)   => window.api.invoke<void>(CHANNELS.SAVE_STATE, state),

    loadSettings: () => window.api.invoke<AtlassianSettings>(CHANNELS.LOAD_SETTINGS),
    saveSettings: (login: string, passwordOrToken?: string, baseUrl?: string) =>
        window.api.invoke<AtlassianSettings>(CHANNELS.SAVE_SETTINGS, { login, passwordOrToken, baseUrl }),

    getAtlassianSecret: (login: string) =>
        window.api.invoke<string>(CHANNELS.GET_ATLASSIAN_SECRET, { login }),

    // ⬇️ теперь указываем, чем является ссылка: id | key
    zephyrGetTestCase: (ref: string, by: 'id' | 'key') =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_GET_TESTCASE, { ref, by }),

    zephyrSearchTestCases: (query: string, startAt = 0, maxResults = 100) =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_SEARCH_TESTCASES, { query, startAt, maxResults }),

    zephyrUpsertTestCase: (body: unknown, ref?: string) =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_UPSERT_TESTCASE, { body, ref }),

    zephyrUploadAttachment: (testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }) =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_UPLOAD_ATTACHMENT, { testCaseKey, attachment }),

    zephyrDeleteAttachment: (attachmentId: string) =>
        window.api.invoke<any>(CHANNELS.ZEPHYR_DELETE_ATTACHMENT, { attachmentId }),

    writeStateSnapshot: (state: RootState, kind = 'snapshot', meta?: Record<string, unknown>) =>
        window.api.invoke<string>(CHANNELS.WRITE_STATE_SNAPSHOT, { state, kind, meta }),

    writePublishLog: (payload: Record<string, unknown>) =>
        window.api.invoke<string>(CHANNELS.WRITE_PUBLISH_LOG, payload),
}
