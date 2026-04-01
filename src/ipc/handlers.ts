// src/ipc/handlers.ts
import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { CHANNELS } from './channels.js'
import type { RootState } from '@core/domain'
import { loadFromFs, saveToFs, writePublishLog, writeStateSnapshot } from '../../electron/repo.js'
import {
    loadSettings as loadUserSettings,
    saveSettings as saveUserSettings,
    getAtlassianSecret as getSecretMain
} from '../../electron/secureSettings.js'

function cleanBaseUrl(u: string) {
    return (u || '').replace(/\/+$/, '')
}
function b64(s: string) {
    return Buffer.from(s, 'utf8').toString('base64')
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
    if (!dataUrlMatch) {
        throw new Error('NOT_A_DATA_URL')
    }
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

export function registerHandlers(ipcMain: IpcMain) {
    ipcMain.handle(CHANNELS.LOAD_STATE, async (_e, fallback) => {
        try { return await loadFromFs() } catch { return fallback }
    })
    ipcMain.handle(CHANNELS.SAVE_STATE, async (_e, state: RootState) => {
        await saveToFs(state); return true
    })
    ipcMain.handle(CHANNELS.WRITE_STATE_SNAPSHOT, async (_e, payload: {
        state: RootState
        kind?: string
        meta?: Record<string, unknown>
    }) => {
        return await writeStateSnapshot(payload.state, payload.kind, payload.meta)
    })
    ipcMain.handle(CHANNELS.WRITE_PUBLISH_LOG, async (_e, payload: Record<string, unknown>) => {
        return await writePublishLog(payload)
    })

    ipcMain.handle(CHANNELS.LOAD_SETTINGS, async () => {
        return await loadUserSettings()
    })
    ipcMain.handle(
        CHANNELS.SAVE_SETTINGS,
        async (_e, payload: { login: string; passwordOrToken?: string; baseUrl?: string }) => {
            return await saveUserSettings(payload.login, payload.passwordOrToken, payload.baseUrl)
        }
    )
    ipcMain.handle(
        CHANNELS.GET_ATLASSIAN_SECRET,
        async (_e, payload: { login: string }) => {
            const s = await getSecretMain(payload.login)
            return s ?? ''
        }
    )

    // ⬇️ Zephyr proxy: ref «как есть», by — только для логики/логирования (endpoint один и тот же)
    ipcMain.handle(
        CHANNELS.ZEPHYR_GET_TESTCASE,
        async (_e, payload: { ref: string; by: 'id' | 'key' }) => {
            const settings = await loadUserSettings()
            const login = settings.login || ''
            const baseUrl = cleanBaseUrl(settings.baseUrl || '')
            if (!login) throw new Error('Atlassian login is empty in settings')
            if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

            const password = (await getSecretMain(login)) || ''
            if (!password) throw new Error('Atlassian password is not stored in keychain')

            // API ATM принимает и id, и key в одном и том же path param
            const url = `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(payload.ref)}`
            const auth = `Basic ${b64(`${login}:${password}`)}`

            const res = await fetchWithContext(url, {
                method: 'GET',
                headers: { Authorization: auth, Accept: 'application/json' },
            }, `Zephyr(${payload.by})`)
            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(
                    `Zephyr(${payload.by}) ${res.status} ${res.statusText}` +
                    (text ? ` – ${text.slice(0, 300)}` : '')
                )
            }
            return await res.json()
        }
    )

    ipcMain.handle(
        CHANNELS.ZEPHYR_SEARCH_TESTCASES,
        async (_e, payload: { query: string; startAt?: number; maxResults?: number }) => {
            const settings = await loadUserSettings()
            const login = settings.login || ''
            const baseUrl = cleanBaseUrl(settings.baseUrl || '')
            if (!login) throw new Error('Atlassian login is empty in settings')
            if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

            const password = (await getSecretMain(login)) || ''
            if (!password) throw new Error('Atlassian password is not stored in keychain')

            const query = String(payload.query ?? '').trim()
            if (!query) throw new Error('Zephyr search query is empty')

            const url = new URL(`${baseUrl}/rest/atm/1.0/testcase/search`)
            url.searchParams.set('query', query)
            url.searchParams.set('startAt', String(Math.max(0, Number(payload.startAt ?? 0) || 0)))
            url.searchParams.set('maxResults', String(Math.max(1, Number(payload.maxResults ?? 100) || 100)))

            const auth = `Basic ${b64(`${login}:${password}`)}`
            const res = await fetchWithContext(url.toString(), {
                method: 'GET',
                headers: { Authorization: auth, Accept: 'application/json' },
            }, 'Zephyr(search)')
            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(
                    `Zephyr(search) ${res.status} ${res.statusText}` +
                    (text ? ` – ${text.slice(0, 300)}` : '')
                )
            }

            return await res.json()
        }
    )

    ipcMain.handle(
        CHANNELS.ZEPHYR_UPSERT_TESTCASE,
        async (_e, payload: { body: unknown; ref?: string }) => {
            const settings = await loadUserSettings()
            const login = settings.login || ''
            const baseUrl = cleanBaseUrl(settings.baseUrl || '')
            if (!login) throw new Error('Atlassian login is empty in settings')
            if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

            const password = (await getSecretMain(login)) || ''
            if (!password) throw new Error('Atlassian password is not stored in keychain')

            const ref = typeof payload.ref === 'string' && payload.ref.trim() ? payload.ref.trim() : ''
            const url = ref
                ? `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(ref)}`
                : `${baseUrl}/rest/atm/1.0/testcase`

            const auth = `Basic ${b64(`${login}:${password}`)}`
            const res = await fetchWithContext(url, {
                method: ref ? 'PUT' : 'POST',
                headers: {
                    Authorization: auth,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload.body ?? {}),
            }, 'Zephyr(upsert)')

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(
                    `Zephyr(upsert) ${res.status} ${res.statusText}` +
                    (text ? ` – ${text.slice(0, 400)}` : '')
                )
            }

            return await res.json().catch(() => ({}))
        }
    )

    ipcMain.handle(
        CHANNELS.ZEPHYR_UPLOAD_ATTACHMENT,
        async (_e, payload: { testCaseKey: string; attachment: { name?: string; pathOrDataUrl?: string } }) => {
            const settings = await loadUserSettings()
            const login = settings.login || ''
            const baseUrl = cleanBaseUrl(settings.baseUrl || '')
            if (!login) throw new Error('Atlassian login is empty in settings')
            if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

            const password = (await getSecretMain(login)) || ''
            if (!password) throw new Error('Atlassian password is not stored in keychain')

            const testCaseKey = String(payload.testCaseKey ?? '').trim()
            if (!testCaseKey) throw new Error('Zephyr attachment upload requires a test case key')

            const attachmentName = String(payload.attachment?.name ?? '').trim() || 'attachment'
            const pathOrDataUrl = String(payload.attachment?.pathOrDataUrl ?? '')
            if (!pathOrDataUrl) throw new Error(`Attachment "${attachmentName}" has no file content`)

            let bytes: Buffer
            try {
                bytes = attachmentToBuffer(pathOrDataUrl)
            } catch {
                bytes = await readFile(pathOrDataUrl)
            }

            const auth = `Basic ${b64(`${login}:${password}`)}`
            const form = new FormData()
            form.append('file', new Blob([Uint8Array.from(bytes)]), attachmentName)

            const url = `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(testCaseKey)}/attachments`
            const res = await fetchWithContext(url, {
                method: 'POST',
                body: form,
                headers: { Authorization: auth },
            }, 'Zephyr(upload attachment)')

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(
                    `Zephyr(upload attachment) ${res.status} ${res.statusText}` +
                    (text ? ` – ${text.slice(0, 400)}` : '')
                )
            }

            return await res.json().catch(() => ({}))
        }
    )

    ipcMain.handle(
        CHANNELS.ZEPHYR_DELETE_ATTACHMENT,
        async (_e, payload: { attachmentId: string }) => {
            const settings = await loadUserSettings()
            const login = settings.login || ''
            const baseUrl = cleanBaseUrl(settings.baseUrl || '')
            if (!login) throw new Error('Atlassian login is empty in settings')
            if (!baseUrl) throw new Error('Atlassian baseUrl is empty in settings')

            const password = (await getSecretMain(login)) || ''
            if (!password) throw new Error('Atlassian password is not stored in keychain')

            const attachmentId = String(payload.attachmentId ?? '').trim()
            if (!attachmentId) throw new Error('Zephyr attachment delete requires an attachment id')

            const auth = `Basic ${b64(`${login}:${password}`)}`
            const url = `${baseUrl}/rest/atm/1.0/attachment/${encodeURIComponent(attachmentId)}`
            const res = await fetchWithContext(url, {
                method: 'DELETE',
                headers: { Authorization: auth, Accept: 'application/json' },
            }, 'Zephyr(delete attachment)')

            if (!res.ok) {
                const text = await res.text().catch(() => '')
                throw new Error(
                    `Zephyr(delete attachment) ${res.status} ${res.statusText}` +
                    (text ? ` – ${text.slice(0, 300)}` : '')
                )
            }

            return true
        }
    )
}
