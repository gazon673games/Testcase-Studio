import {
    getAtlassianSecret as getSecretMain,
    loadSettings as loadUserSettings,
    saveSettings as saveUserSettings,
} from '../../../electron/secureSettings.js'

export type ZephyrContext = {
    baseUrl: string
    auth: string
}

function cleanBaseUrl(value: string) {
    return (value || '').replace(/\/+$/, '')
}

function b64(value: string) {
    return Buffer.from(value, 'utf8').toString('base64')
}

export async function loadMainSettings() {
    return await loadUserSettings()
}

export async function saveMainSettings(payload: { login: string; passwordOrToken?: string; baseUrl?: string }) {
    return await saveUserSettings(payload.login, payload.passwordOrToken, payload.baseUrl)
}

export async function loadZephyrContext(): Promise<ZephyrContext> {
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
