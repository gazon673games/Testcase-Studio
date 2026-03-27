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
    type TestCase,
} from '../src/core/domain'

const REPO_DIR = 'tests_repo'
const ROOT_DIR = 'root'
const FOLDER_META_FILE = 'folder.json'
const SHARED_STEPS_FILE = 'shared_steps.json'

function getBaseDir() {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

function slugify(name: string) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'node'
}

function isTestFolder(entries: string[]) {
    return entries.includes('test.json')
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

async function readFolderMeta(dir: string): Promise<{ id?: string; name?: string } | null> {
    return readJsonFile<{ id?: string; name?: string }>(path.join(dir, FOLDER_META_FILE))
}

async function loadSharedSteps(baseDir: string) {
    const raw = await readJsonFile<any[]>(path.join(baseDir, SHARED_STEPS_FILE))
    return Array.isArray(raw) ? raw.map(normalizeSharedStep) : []
}

export async function loadFromFs(): Promise<RootState> {
    const baseDir = path.join(getBaseDir(), REPO_DIR)
    const rootDir = path.join(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    async function readNode(dir: string, fallbackName: string): Promise<Folder | TestCase> {
        const entries = await fsp.readdir(dir)
        if (isTestFolder(entries)) {
            const raw = await fsp.readFile(path.join(dir, 'test.json'), 'utf-8')
            return normalizeTestCase(JSON.parse(raw))
        }

        const meta = await readFolderMeta(dir)
        const folder: Folder = {
            id: typeof meta?.id === 'string' && meta.id.trim() ? meta.id : randomUUID(),
            name: typeof meta?.name === 'string' && meta.name.trim() ? meta.name : fallbackName,
            children: [],
        }

        for (const entry of entries) {
            const childPath = path.join(dir, entry)
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
    const baseDir = path.join(getBaseDir(), REPO_DIR)
    const rootDir = path.join(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    async function writeFolder(fsDir: string, folder: Folder) {
        await ensureDir(fsDir)
        await fsp.writeFile(
            path.join(fsDir, FOLDER_META_FILE),
            JSON.stringify({ id: folder.id, name: folder.name }, null, 2),
            'utf-8'
        )

        const desired = new Map<string, { node: Folder | TestCase }>()
        for (const child of folder.children) {
            if ('children' in child) {
                desired.set(path.join(fsDir, child.name), { node: child })
                continue
            }

            const slug = slugify(child.name)
            const idSuffix = child.id?.slice(0, 6) ?? randomUUID().slice(0, 6)
            desired.set(path.join(fsDir, `${slug}__${idSuffix}`), { node: child })
        }

        for (const [targetPath, entry] of desired.entries()) {
            if ('children' in entry.node) {
                await writeFolder(targetPath, entry.node)
            } else {
                await ensureDir(targetPath)
                await ensureDir(path.join(targetPath, 'attachments'))
                await fsp.writeFile(
                    path.join(targetPath, 'test.json'),
                    JSON.stringify(normalizeTestCase(entry.node), null, 2),
                    'utf-8'
                )
            }
        }

        const current = await fsp.readdir(fsDir)
        for (const entry of current) {
            const currentPath = path.join(fsDir, entry)
            const stat = await fsp.lstat(currentPath)
            if (!stat.isDirectory()) continue
            if (!desired.has(currentPath)) {
                await fsp.rm(currentPath, { recursive: true, force: true })
            }
        }
    }

    await writeFolder(rootDir, normalized.root)
    await fsp.writeFile(
        path.join(baseDir, SHARED_STEPS_FILE),
        JSON.stringify(normalized.sharedSteps, null, 2),
        'utf-8'
    )
}
