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

export async function loadSettings(): Promise<AtlassianSettings> {
    try {
        const raw = await fsp.readFile(SETTINGS_PATH, 'utf-8')
        const parsed = JSON.parse(raw) as { email?: string }
        const hasSecret = parsed.email ? !!(await keytar.getPassword(SERVICE, parsed.email)) : false
        return { email: parsed.email ?? "", hasSecret }
    } catch {
        return { email: "", hasSecret: false }
    }
}

export async function saveSettings(email: string, passwordOrToken?: string): Promise<AtlassianSettings> {
    await ensureDir(SETTINGS_PATH)
    // сохраняем НЕсекретную часть
    await fsp.writeFile(SETTINGS_PATH, JSON.stringify({ email }, null, 2), 'utf-8')
    // секрет — в keychain, если прислали
    if (email && typeof passwordOrToken === 'string' && passwordOrToken.length > 0) {
        await keytar.setPassword(SERVICE, email, passwordOrToken)
    }
    const hasSecret = email ? !!(await keytar.getPassword(SERVICE, email)) : false
    return { email, hasSecret }
}

// helper для провайдеров (получить секрет в main-процессе)
export async function getAtlassianSecret(email: string): Promise<string | null> {
    if (!email) return null
    return await keytar.getPassword(SERVICE, email)
}
