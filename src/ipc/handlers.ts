// src/ipc/handlers.ts
import type { IpcMain } from 'electron'
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

            const res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: auth, Accept: 'application/json' },
            })
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
            const res = await fetch(url, {
                method: 'GET',
                headers: { Authorization: auth, Accept: 'application/json' },
            })
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
            const res = await fetch(url, {
                method: ref ? 'PUT' : 'POST',
                headers: {
                    Authorization: auth,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload.body ?? {}),
            })

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
}
