import { app } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fsp } from 'fs'
import path from 'node:path'
import {
    normalizeSharedStep,
    normalizeTestCase,
    type Folder,
    type SharedStep,
    type TestCase,
} from '../../src/core/domain'

export const REPO_DIR = 'tests_repo'
export const ROOT_DIR = 'root'
export const FOLDER_META_FILE = 'folder.json'
export const TEST_FILE = 'test.json'
export const SHARED_STEPS_FILE = 'shared_steps.json'
export const ATTACHMENTS_DIR = 'attachments'
export const SNAPSHOTS_DIR = '.snapshots'
export const PUBLISH_LOGS_DIR = '.publish-logs'

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export type RepoFolderEntry = {
    id: string
    path: string
    parentId: string | null
    name: string
    metaJson: string
}

export type RepoTestEntry = {
    id: string
    path: string
    parentId: string
    contentJson: string
}

export type RepoIndex = {
    baseDir: string
    rootDir: string
    folders: Map<string, RepoFolderEntry>
    tests: Map<string, RepoTestEntry>
    folderChildren: Map<string, Set<string>>
    testChildren: Map<string, Set<string>>
    sharedStepsJson: string
}

export function getBaseDir() {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

export function getRepoDir() {
    return path.resolve(path.join(getBaseDir(), REPO_DIR))
}

export function assertPathInside(baseDir: string, targetPath: string) {
    const resolvedBase = path.resolve(baseDir)
    const resolvedTarget = path.resolve(targetPath)

    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
        throw new Error(`Resolved path escapes repository: ${resolvedTarget}`)
    }

    return resolvedTarget
}

export function joinInside(baseDir: string, ...segments: string[]) {
    return assertPathInside(baseDir, path.join(baseDir, ...segments))
}

function slugify(label: string) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'node'
}

function safeLabel(value: string, fallback: string) {
    const normalized = slugify(value).replace(/^\.+$/, '') || fallback
    return WINDOWS_RESERVED_RE.test(normalized) ? `${fallback}-${normalized}` : normalized
}

export function safeNodeDirName(name: string, id: string | undefined, fallback: string) {
    const label = safeLabel(name, fallback)
    const suffixSource = typeof id === 'string' && id.trim() ? id.trim() : randomUUID()
    return `${label}__${suffixSource.slice(0, 6)}`
}

export function safeSnapshotKind(kind: string | undefined) {
    return safeLabel(String(kind ?? 'snapshot'), 'snapshot')
}

export function isTestFolder(entryNames: string[]) {
    return entryNames.includes(TEST_FILE)
}

export async function ensureDir(targetPath: string) {
    await fsp.mkdir(targetPath, { recursive: true })
}

export async function pathExists(targetPath: string) {
    try {
        await fsp.access(targetPath)
        return true
    } catch {
        return false
    }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const raw = await fsp.readFile(filePath, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

export async function readJsonFileStrict<T>(filePath: string): Promise<T> {
    const raw = await fsp.readFile(filePath, 'utf-8')

    try {
        return JSON.parse(raw) as T
    } catch (error) {
        throw new Error(
            `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

export function serializeFolderMeta(folder: Pick<Folder, 'id' | 'name'>) {
    return JSON.stringify({ id: folder.id, name: folder.name }, null, 2)
}

export function serializeTestFile(test: TestCase) {
    return JSON.stringify(normalizeTestCase(test), null, 2)
}

export function serializeSharedSteps(sharedSteps: SharedStep[]) {
    return JSON.stringify(sharedSteps.map((shared) => normalizeSharedStep(shared)), null, 2)
}
