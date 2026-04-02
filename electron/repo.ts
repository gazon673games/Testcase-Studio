import { app } from 'electron'
import { promises as fsp } from 'fs'
import path from 'node:path'
import { randomUUID } from 'crypto'
import {
    normalizeRootState,
    normalizeSharedStep,
    normalizeTestCase,
    type Folder,
    type RootState,
    type SharedStep,
    type TestCase,
} from '../src/core/domain'

const REPO_DIR = 'tests_repo'
const ROOT_DIR = 'root'
const FOLDER_META_FILE = 'folder.json'
const TEST_FILE = 'test.json'
const SHARED_STEPS_FILE = 'shared_steps.json'
const ATTACHMENTS_DIR = 'attachments'
const SNAPSHOTS_DIR = '.snapshots'
const PUBLISH_LOGS_DIR = '.publish-logs'
const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

function getBaseDir() {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

function getRepoDir() {
    return path.resolve(path.join(getBaseDir(), REPO_DIR))
}

function assertPathInside(baseDir: string, targetPath: string) {
    const resolvedBase = path.resolve(baseDir)
    const resolvedTarget = path.resolve(targetPath)
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
        throw new Error(`Resolved path escapes repository: ${resolvedTarget}`)
    }
    return resolvedTarget
}

function joinInside(baseDir: string, ...segments: string[]) {
    return assertPathInside(baseDir, path.join(baseDir, ...segments))
}

function slugify(name: string) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'node'
}

function safeLabel(value: string, fallback: string) {
    const normalized = slugify(value).replace(/^\.+$/, '') || fallback
    return WINDOWS_RESERVED_RE.test(normalized) ? `${fallback}-${normalized}` : normalized
}

function safeNodeDirName(name: string, id: string | undefined, fallback: string) {
    const label = safeLabel(name, fallback)
    const suffixSource = typeof id === 'string' && id.trim() ? id.trim() : randomUUID()
    return `${label}__${suffixSource.slice(0, 6)}`
}

function safeSnapshotKind(kind: string | undefined) {
    return safeLabel(String(kind ?? 'snapshot'), 'snapshot')
}

function isTestFolder(entries: string[]) {
    return entries.includes(TEST_FILE)
}

async function ensureDir(targetPath: string) {
    await fsp.mkdir(targetPath, { recursive: true })
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const raw = await fsp.readFile(filePath, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

async function readJsonFileStrict<T>(filePath: string): Promise<T> {
    const raw = await fsp.readFile(filePath, 'utf-8')
    try {
        return JSON.parse(raw) as T
    } catch (error) {
        throw new Error(
            `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

async function readFolderMeta(dir: string): Promise<{ id?: string; name?: string } | null> {
    return readJsonFile<{ id?: string; name?: string }>(joinInside(dir, FOLDER_META_FILE))
}

async function loadSharedSteps(baseDir: string) {
    const filePath = joinInside(baseDir, SHARED_STEPS_FILE)
    try {
        const raw = await readJsonFileStrict<Array<Partial<SharedStep>>>(filePath)
        return Array.isArray(raw) ? raw.map((shared) => normalizeSharedStep(shared)) : []
    } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err?.code === 'ENOENT') return []
        throw error
    }
}

export async function loadFromFs(): Promise<RootState> {
    const baseDir = getRepoDir()
    const rootDir = joinInside(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    async function readNode(dir: string, fallbackName: string): Promise<Folder | TestCase> {
        const safeDir = assertPathInside(baseDir, dir)
        const entries = await fsp.readdir(safeDir)
        if (isTestFolder(entries)) {
            return normalizeTestCase(await readJsonFileStrict(joinInside(safeDir, TEST_FILE)))
        }

        const meta = await readFolderMeta(safeDir)
        const folder: Folder = {
            id: typeof meta?.id === 'string' && meta.id.trim() ? meta.id : randomUUID(),
            name: typeof meta?.name === 'string' && meta.name.trim() ? meta.name : fallbackName,
            children: [],
        }

        for (const entry of entries) {
            const childPath = joinInside(safeDir, entry)
            const stat = await fsp.lstat(childPath)
            if (!stat.isDirectory()) continue
            folder.children.push(await readNode(childPath, entry))
        }

        return folder
    }

    const root = await readNode(rootDir, 'Root')
    const sharedSteps = await loadSharedSteps(baseDir)
    return normalizeRootState({ root: root as Folder, sharedSteps })
}

export async function saveToFs(state: RootState) {
    const normalized = normalizeRootState(state)
    const baseDir = getRepoDir()
    const rootDir = joinInside(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    async function writeFolder(fsDir: string, folder: Folder) {
        const safeDir = assertPathInside(baseDir, fsDir)
        await ensureDir(safeDir)
        await fsp.writeFile(
            joinInside(safeDir, FOLDER_META_FILE),
            JSON.stringify({ id: folder.id, name: folder.name }, null, 2),
            'utf-8'
        )

        const desired = new Map<string, { node: Folder | TestCase }>()
        for (const child of folder.children) {
            const targetName = 'children' in child
                ? safeNodeDirName(child.name, child.id, 'folder')
                : safeNodeDirName(child.name, child.id, 'test')
            desired.set(joinInside(safeDir, targetName), { node: child })
        }

        for (const [targetPath, entry] of desired.entries()) {
            if ('children' in entry.node) {
                await writeFolder(targetPath, entry.node)
            } else {
                await ensureDir(targetPath)
                await ensureDir(joinInside(targetPath, ATTACHMENTS_DIR))
                await fsp.writeFile(
                    joinInside(targetPath, TEST_FILE),
                    JSON.stringify(normalizeTestCase(entry.node), null, 2),
                    'utf-8'
                )
            }
        }

        const current = await fsp.readdir(safeDir)
        for (const entry of current) {
            const currentPath = joinInside(safeDir, entry)
            const stat = await fsp.lstat(currentPath)
            if (!stat.isDirectory()) continue
            if (!desired.has(currentPath)) {
                await fsp.rm(currentPath, { recursive: true, force: true })
            }
        }
    }

    await writeFolder(rootDir, normalized.root)
    await fsp.writeFile(
        joinInside(baseDir, SHARED_STEPS_FILE),
        JSON.stringify(normalized.sharedSteps, null, 2),
        'utf-8'
    )
}

export async function writeStateSnapshot(
    state: RootState,
    kind = 'snapshot',
    meta?: Record<string, unknown>
): Promise<string> {
    const normalized = normalizeRootState(state)
    const baseDir = joinInside(getRepoDir(), SNAPSHOTS_DIR)
    await ensureDir(baseDir)
    const filePath = joinInside(baseDir, `${safeSnapshotKind(kind)}-${timestampLabel()}.json`)
    await fsp.writeFile(
        filePath,
        JSON.stringify({ createdAt: new Date().toISOString(), kind, meta: meta ?? {}, state: normalized }, null, 2),
        'utf-8'
    )
    return filePath
}

export async function writePublishLog(payload: Record<string, unknown>): Promise<string> {
    const baseDir = joinInside(getRepoDir(), PUBLISH_LOGS_DIR)
    await ensureDir(baseDir)
    const filePath = joinInside(baseDir, `publish-${timestampLabel()}.json`)
    await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return filePath
}

function timestampLabel() {
    const now = new Date()
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('')
    const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('-')
    return `${date}-${time}`
}
