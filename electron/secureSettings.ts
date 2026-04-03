import { promises as fsp } from 'fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'
import type { AtlassianSettings } from '../src/core/settings'
import { getWorkspaceDir } from './runtimePaths'

const PRIMARY_SERVICE = 'testcase-studio-atlassian'
const LEGACY_SERVICE = 'testshub-atlassian'
let keytarWarningShown = false
let keytarModulePromise: Promise<KeytarModule | null> | null = null

function getBaseDir() {
    return getWorkspaceDir()
}

const SETTINGS_PATH = path.join(getBaseDir(), '.settings.json')

async function ensureDir(filePath: string) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
}

type FileShape = { login?: string; baseUrl?: string; encryptedSecret?: string }
type KeytarModule = {
    getPassword(service: string, account: string): Promise<string | null>
    setPassword(service: string, account: string, password: string): Promise<void>
}

function warnKeytarFailure(error: unknown) {
    if (keytarWarningShown) return
    keytarWarningShown = true
    console.warn(
        'OS credential store is unavailable, falling back to encrypted workspace storage.',
        error instanceof Error ? error.message : String(error)
    )
}

async function getKeytar(): Promise<KeytarModule | null> {
    if (!keytarModulePromise) {
        keytarModulePromise = import('keytar')
            .then((module) => (module.default ?? module) as KeytarModule)
            .catch((error) => {
                warnKeytarFailure(error)
                return null
            })
    }

    return keytarModulePromise
}

async function keytarGetPassword(service: string, login: string): Promise<string | null> {
    const keytar = await getKeytar()
    if (!keytar || !login) return null

    try {
        return await keytar.getPassword(service, login)
    } catch (error) {
        warnKeytarFailure(error)
        return null
    }
}

async function keytarSetPassword(service: string, login: string, secret: string): Promise<boolean> {
    const keytar = await getKeytar()
    if (!keytar || !login || !secret) return false

    try {
        await keytar.setPassword(service, login, secret)
        return true
    } catch (error) {
        warnKeytarFailure(error)
        return false
    }
}

async function readSettingsFile(): Promise<FileShape> {
    try {
        const raw = await fsp.readFile(SETTINGS_PATH, 'utf-8')
        return JSON.parse(raw) as FileShape
    } catch {
        return {}
    }
}

function encryptSecretForFile(secret: string): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null

    try {
        return safeStorage.encryptString(secret).toString('base64')
    } catch {
        return null
    }
}

function decryptSecretFromFile(encodedSecret: string | undefined): string | null {
    if (!encodedSecret) return null
    if (!safeStorage.isEncryptionAvailable()) return null

    try {
        return safeStorage.decryptString(Buffer.from(encodedSecret, 'base64'))
    } catch {
        return null
    }
}

async function getStoredSecret(login: string): Promise<string | null> {
    if (!login) return null

    const currentSecret = await keytarGetPassword(PRIMARY_SERVICE, login)
    if (currentSecret) return currentSecret

    const legacySecret = await keytarGetPassword(LEGACY_SERVICE, login)
    if (legacySecret) {
        await keytarSetPassword(PRIMARY_SERVICE, login, legacySecret)
        return legacySecret
    }

    const filePayload = await readSettingsFile()
    if (filePayload.login !== login) return null

    const fileSecret = decryptSecretFromFile(filePayload.encryptedSecret)
    if (fileSecret) {
        await keytarSetPassword(PRIMARY_SERVICE, login, fileSecret)
    }

    return fileSecret
}

export async function loadSettings(): Promise<AtlassianSettings> {
    try {
        const parsed = await readSettingsFile()
        const login = parsed.login ?? ''
        const baseUrl = parsed.baseUrl ?? ''
        const hasSecret = login ? !!(await getStoredSecret(login)) : false
        return { login, baseUrl, hasSecret }
    } catch {
        return { login: '', baseUrl: '', hasSecret: false }
    }
}

export async function saveSettings(
    login: string,
    passwordOrToken?: string,
    baseUrl?: string
): Promise<AtlassianSettings> {
    await ensureDir(SETTINGS_PATH)
    const existing = await readSettingsFile()
    let encryptedSecret = login === existing.login ? existing.encryptedSecret : undefined

    // Save the secret in the system credential store when possible, otherwise keep an encrypted fallback.
    if (login && typeof passwordOrToken === 'string' && passwordOrToken.length > 0) {
        const storedInKeytar = await keytarSetPassword(PRIMARY_SERVICE, login, passwordOrToken)
        encryptedSecret = storedInKeytar ? undefined : encryptSecretForFile(passwordOrToken) ?? undefined
    }

    // Keep non-secret settings in the workspace file and only persist the encrypted secret as fallback.
    const filePayload: FileShape = { login, baseUrl, ...(encryptedSecret ? { encryptedSecret } : {}) }
    await fsp.writeFile(SETTINGS_PATH, JSON.stringify(filePayload, null, 2), 'utf-8')

    const hasSecret = login ? !!(await getStoredSecret(login)) : false
    return { login, baseUrl: baseUrl ?? '', hasSecret }
}

// Used by the main process when a sync provider needs the stored secret.
export async function getAtlassianSecret(login: string): Promise<string | null> {
    return await getStoredSecret(login)
}
