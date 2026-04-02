import { app } from 'electron'
import path from 'node:path'
import { promises as fsp } from 'fs'
import keytar from 'keytar'
import type { AtlassianSettings } from '../src/core/settings'

const PRIMARY_SERVICE = 'testcase-studio-atlassian'
const LEGACY_SERVICE = 'testshub-atlassian'

function getBaseDir() {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

const SETTINGS_PATH = path.join(getBaseDir(), 'tests_repo', '.settings.json')

async function ensureDir(filePath: string) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
}

type FileShape = { login?: string; baseUrl?: string }

async function getStoredSecret(login: string): Promise<string | null> {
    if (!login) return null

    const currentSecret = await keytar.getPassword(PRIMARY_SERVICE, login)
    if (currentSecret) return currentSecret

    const legacySecret = await keytar.getPassword(LEGACY_SERVICE, login)
    if (!legacySecret) return null

    // Migrate legacy secrets lazily so existing users keep working after the rename.
    await keytar.setPassword(PRIMARY_SERVICE, login, legacySecret)
    return legacySecret
}

export async function loadSettings(): Promise<AtlassianSettings> {
    try {
        const raw = await fsp.readFile(SETTINGS_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as FileShape
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

    // Keep only non-secret settings in the workspace file.
    const filePayload: FileShape = { login, baseUrl }
    await fsp.writeFile(SETTINGS_PATH, JSON.stringify(filePayload, null, 2), 'utf-8')

    // Save the secret in the system credential store when a new value is provided.
    if (login && typeof passwordOrToken === 'string' && passwordOrToken.length > 0) {
        await keytar.setPassword(PRIMARY_SERVICE, login, passwordOrToken)
    }

    const hasSecret = login ? !!(await getStoredSecret(login)) : false
    return { login, baseUrl: baseUrl ?? '', hasSecret }
}

// Used by the main process when a sync provider needs the stored secret.
export async function getAtlassianSecret(login: string): Promise<string | null> {
    return await getStoredSecret(login)
}
