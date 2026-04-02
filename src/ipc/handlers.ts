// src/ipc/handlers.ts
import type { IpcMain } from 'electron'
import {
    SyncEngine,
    buildZephyrImportQuery,
    createSyncText,
    type SyncFetchZephyrPublishEntry,
    type ZephyrImportRequest,
    type ZephyrPublishPreview,
} from '../application/sync/index.js'
import type { RootState, TestCase, TestCaseLink } from '../core/domain.js'
import { AllureStubProvider } from '../providers/allure.stub.js'
import type { ITestProvider } from '../providers/types.js'
import { ZephyrHttpProvider, type ZephyrApiClient } from '../providers/zephyr.http.js'
import { CHANNELS } from './channels.js'
import { loadFromFs, saveToFs, writePublishLog, writeStateSnapshot } from '../../electron/repo.js'
import {
    loadSettings as loadUserSettings,
    saveSettings as saveUserSettings,
    getAtlassianSecret as getSecretMain,
} from '../../electron/secureSettings.js'

type ZephyrContext = {
    baseUrl: string
    auth: string
}

function cleanBaseUrl(value: string) {
    return (value || '').replace(/\/+$/, '')
}

function b64(value: string) {
    return Buffer.from(value, 'utf8').toString('base64')
}

async function fetchWithContext(url: string, init: RequestInit, scope: string) {
    try {
        return await fetch(url, init)
    } catch (error) {
        const host = safeHost(url)
        const detail = describeFetchFailure(error)
        throw new Error(`${scope} network error for ${host}${detail ? `: ${detail}` : ''}`)
    }
}

function attachmentToBuffer(pathOrDataUrl: string): Buffer {
    const raw = String(pathOrDataUrl ?? '')
    const dataUrlMatch = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i)
    if (!dataUrlMatch) throw new Error('NOT_A_DATA_URL')
    const payload = dataUrlMatch[3] ?? ''
    return dataUrlMatch[2] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
}

function safeHost(url: string): string {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

function describeFetchFailure(error: unknown): string {
    if (!(error instanceof Error)) return String(error)
    const cause = (error as Error & { cause?: unknown }).cause
    const causeMessage =
        cause instanceof Error
            ? cause.message
            : cause != null
                ? String(cause)
                : ''
    const joined = [error.message, causeMessage].filter(Boolean).join(' | ')
    const normalized = joined.toLowerCase()

    if (normalized.includes('enotfound') || normalized.includes('getaddrinfo') || normalized.includes('dns')) {
        return 'host was not resolved; check VPN/corporate DNS or base URL'
    }
    if (normalized.includes('self signed') || normalized.includes('certificate') || normalized.includes('cert')) {
        return 'TLS certificate validation failed'
    }
    if (normalized.includes('econnrefused')) {
        return 'connection was refused by the remote host'
    }
    if (normalized.includes('etimedout') || normalized.includes('timeout')) {
        return 'request timed out'
    }
    if (normalized.includes('fetch failed')) {
        return causeMessage || error.message
    }
    return joined
}

async function loadZephyrContext(): Promise<ZephyrContext> {
    const settings = await loadUserSettings()
    const login = String(settings.login ?? '').trim()
    const baseUrl = cleanBaseUrl(settings.baseUrl || '')
    if (!login) throw new Error('Atlassian login is empty in settings')
    if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

    const password = String((await getSecretMain(login)) || '').trim()
    if (!password) throw new Error('Atlassian password is not stored in keychain')

    return {
        baseUrl,
        auth: `Basic ${b64(`${login}:${password}`)}`,
    }
}

async function readJsonResponse<T>(response: Response, scope: string, limit = 400, fallback?: T): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(
            `${scope} ${response.status} ${response.statusText}` +
            (text ? ` - ${text.slice(0, limit)}` : '')
        )
    }

    return await response.json().catch(() => fallback as T)
}

async function ensureOk(response: Response, scope: string, limit = 400) {
    if (response.ok) return
    const text = await response.text().catch(() => '')
    throw new Error(
        `${scope} ${response.status} ${response.statusText}` +
        (text ? ` - ${text.slice(0, limit)}` : '')
    )
}

function createMainZephyrClient(): ZephyrApiClient {
    return {
        async zephyrGetTestCase<T = unknown>(ref: string, by: 'id' | 'key') {
            const { baseUrl, auth } = await loadZephyrContext()
            const response = await fetchWithContext(
                `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(ref)}`,
                {
                    method: 'GET',
                    headers: { Authorization: auth, Accept: 'application/json' },
                },
                `Zephyr(${by})`
            )
            return readJsonResponse<T>(response, `Zephyr(${by})`, 300)
        },

        async zephyrSearchTestCases<T = unknown>(query: string, startAt = 0, maxResults = 100) {
            const { baseUrl, auth } = await loadZephyrContext()
            const normalizedQuery = String(query ?? '').trim()
            if (!normalizedQuery) throw new Error('Zephyr search query is empty')

            const url = new URL(`${baseUrl}/rest/atm/1.0/testcase/search`)
            url.searchParams.set('query', normalizedQuery)
            url.searchParams.set('startAt', String(Math.max(0, Number(startAt) || 0)))
            url.searchParams.set('maxResults', String(Math.max(1, Number(maxResults) || 100)))

            const response = await fetchWithContext(url.toString(), {
                method: 'GET',
                headers: { Authorization: auth, Accept: 'application/json' },
            }, 'Zephyr(search)')
            return readJsonResponse<T>(response, 'Zephyr(search)', 300)
        },

        async zephyrUpsertTestCase<T = unknown>(body: unknown, ref?: string) {
            const { baseUrl, auth } = await loadZephyrContext()
            const normalizedRef = typeof ref === 'string' && ref.trim() ? ref.trim() : ''
            const url = normalizedRef
                ? `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(normalizedRef)}`
                : `${baseUrl}/rest/atm/1.0/testcase`
            const response = await fetchWithContext(url, {
                method: normalizedRef ? 'PUT' : 'POST',
                headers: {
                    Authorization: auth,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body ?? {}),
            }, 'Zephyr(upsert)')
            return readJsonResponse<T>(response, 'Zephyr(upsert)', 400, {} as T)
        },

        async zephyrUploadAttachment(testCaseKey: string, attachment: { name: string; pathOrDataUrl: string }) {
            const { baseUrl, auth } = await loadZephyrContext()
            const normalizedKey = String(testCaseKey ?? '').trim()
            if (!normalizedKey) throw new Error('Zephyr attachment upload requires a test case key')

            const attachmentName = String(attachment?.name ?? '').trim() || 'attachment'
            const pathOrDataUrl = String(attachment?.pathOrDataUrl ?? '')
            if (!pathOrDataUrl) throw new Error(`Attachment "${attachmentName}" has no file content`)

            let bytes: Buffer
            try {
                bytes = attachmentToBuffer(pathOrDataUrl)
            } catch {
                throw new Error(`Attachment "${attachmentName}" must be embedded as a data URL before upload`)
            }

            const form = new FormData()
            form.append('file', new Blob([Uint8Array.from(bytes)]), attachmentName)

            const response = await fetchWithContext(
                `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(normalizedKey)}/attachments`,
                {
                    method: 'POST',
                    body: form,
                    headers: { Authorization: auth },
                },
                'Zephyr(upload attachment)'
            )
            await readJsonResponse(response, 'Zephyr(upload attachment)', 400, {})
        },

        async zephyrDeleteAttachment(attachmentId: string) {
            const { baseUrl, auth } = await loadZephyrContext()
            const normalizedId = String(attachmentId ?? '').trim()
            if (!normalizedId) throw new Error('Zephyr attachment delete requires an attachment id')

            const response = await fetchWithContext(
                `${baseUrl}/rest/atm/1.0/attachment/${encodeURIComponent(normalizedId)}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: auth, Accept: 'application/json' },
                },
                'Zephyr(delete attachment)'
            )
            await ensureOk(response, 'Zephyr(delete attachment)', 300)
        },
    }
}

function createMainSyncContext() {
    const zephyr = new ZephyrHttpProvider(createMainZephyrClient())
    const sync = new SyncEngine(
        {
            zephyr,
            allure: new AllureStubProvider(),
        },
        createSyncText((key) => key)
    )

    return { sync, zephyr }
}

async function collectZephyrImportRefs(
    provider: ITestProvider,
    query: string,
    request: Pick<ZephyrImportRequest, 'mode' | 'refs' | 'maxResults'>
) {
    if (request.mode === 'keys') {
        return [...new Set((request.refs ?? []).map((ref) => String(ref).trim()).filter(Boolean))]
    }

    if (!provider.searchTestsByQuery) throw new Error('Current Zephyr provider does not support search import')
    const refs = await provider.searchTestsByQuery(query, { maxResults: request.maxResults ?? 100 })
    return [...new Set(refs.map((item) => item.ref).filter(Boolean))]
}

export function registerHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_STATE, async () => {
        return await loadFromFs()
    })

    ipcMain.handle(CHANNELS.SAVE_STATE, async (_event, state: RootState) => {
        await saveToFs(state)
        return true
    })

    ipcMain.handle(CHANNELS.WRITE_STATE_SNAPSHOT, async (_event, payload: {
        state: RootState
        kind?: string
        meta?: Record<string, unknown>
    }) => {
        return await writeStateSnapshot(payload.state, payload.kind, payload.meta)
    })

    ipcMain.handle(CHANNELS.WRITE_PUBLISH_LOG, async (_event, payload: Record<string, unknown>) => {
        return await writePublishLog(payload)
    })

    ipcMain.handle(CHANNELS.LOAD_SETTINGS, async () => {
        return await loadUserSettings()
    })

    ipcMain.handle(
        CHANNELS.SAVE_SETTINGS,
        async (_event, payload: { login: string; passwordOrToken?: string; baseUrl?: string }) => {
            return await saveUserSettings(payload.login, payload.passwordOrToken, payload.baseUrl)
        }
    )

    ipcMain.handle(CHANNELS.SYNC_PULL_BY_LINK, async (_event, payload: { link: TestCaseLink }) => {
        const { sync } = createMainSyncContext()
        return sync.pullByLink(payload.link)
    })

    ipcMain.handle(
        CHANNELS.SYNC_PUSH_TEST,
        async (_event, payload: { test: TestCase; link: TestCaseLink; state?: RootState }) => {
            const { sync } = createMainSyncContext()
            return sync.pushTest(payload.test, payload.link, payload.state)
        }
    )

    ipcMain.handle(CHANNELS.SYNC_TWO_WAY_SYNC, async (_event, payload: { state: RootState }) => {
        const { sync } = createMainSyncContext()
        const nextState = structuredClone(payload.state)
        await sync.twoWaySync(nextState)
        return nextState
    })

    ipcMain.handle(
        CHANNELS.SYNC_FETCH_ZEPHYR_IMPORT,
        async (_event, payload: { request: ZephyrImportRequest }) => {
            const { zephyr } = createMainSyncContext()
            const query = buildZephyrImportQuery(payload.request)
            const refs = await collectZephyrImportRefs(zephyr, query, payload.request)
            const remotes = await Promise.all(
                refs.map((ref) => zephyr.getTestDetails(ref))
            )
            return { query, remotes }
        }
    )

    ipcMain.handle(
        CHANNELS.SYNC_FETCH_ZEPHYR_PUBLISH,
        async (_event, payload: { externalIds: string[] }) => {
            const { zephyr } = createMainSyncContext()
            const externalIds = [...new Set((payload.externalIds ?? []).map((item) => String(item).trim()).filter(Boolean))]

            return await Promise.all(
                externalIds.map(async (externalId): Promise<SyncFetchZephyrPublishEntry> => {
                    try {
                        return {
                            externalId,
                            remote: await zephyr.getTestDetails(externalId),
                        }
                    } catch (error) {
                        return {
                            externalId,
                            error: error instanceof Error ? error.message : String(error),
                        }
                    }
                })
            )
        }
    )

    ipcMain.handle(
        CHANNELS.SYNC_PUBLISH_ZEPHYR_PREVIEW,
        async (_event, payload: { state: RootState; preview: ZephyrPublishPreview }) => {
            const { sync } = createMainSyncContext()
            const nextState = structuredClone(payload.state)
            const result = await sync.publishZephyrPreview(nextState, payload.preview)
            return { state: nextState, result }
        }
    )
}
