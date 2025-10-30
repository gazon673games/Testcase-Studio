import { app } from 'electron'
import path from 'node:path'
import { promises as fsp } from 'fs'
import keytar from 'keytar'
import type { AtlassianSettings } from '../src/core/settings'

const SERVICE = 'testshub-atlassian'

function getBaseDir() {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}
const SETTINGS_PATH = path.join(getBaseDir(), 'tests_repo', '.settings.json')

async function ensureDir(filePath: string) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
}

type FileShape = { login?: string; baseUrl?: string }

export async function loadSettings(): Promise<AtlassianSettings> {
    try {
        const raw = await fsp.readFile(SETTINGS_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as FileShape
        const login = parsed.login ?? ''
        const baseUrl = parsed.baseUrl ?? ''
        const hasSecret = login ? !!(await keytar.getPassword(SERVICE, login)) : false
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

    // сохраняем НЕсекретную часть
    const filePayload: FileShape = { login, baseUrl }
    await fsp.writeFile(SETTINGS_PATH, JSON.stringify(filePayload, null, 2), 'utf-8')

    // секрет — в keychain, если прислали
    if (login && typeof passwordOrToken === 'string' && passwordOrToken.length > 0) {
        await keytar.setPassword(SERVICE, login, passwordOrToken)
    }

    const hasSecret = login ? !!(await keytar.getPassword(SERVICE, login)) : false
    return { login, baseUrl: baseUrl ?? '', hasSecret }
}

// helper для провайдеров (получить секрет в main-процессе)
export async function getAtlassianSecret(login: string): Promise<string | null> {
    if (!login) return null
    return await keytar.getPassword(SERVICE, login)
}
