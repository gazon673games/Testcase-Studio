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

type RepoFolderEntry = {
    id: string
    path: string
    parentId: string | null
    name: string
    metaJson: string
}

type RepoTestEntry = {
    id: string
    path: string
    parentId: string
    contentJson: string
}

type RepoIndex = {
    baseDir: string
    rootDir: string
    folders: Map<string, RepoFolderEntry>
    tests: Map<string, RepoTestEntry>
    folderChildren: Map<string, Set<string>>
    testChildren: Map<string, Set<string>>
    sharedStepsJson: string
}

let repoIndexCache: RepoIndex | null = null

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

async function pathExists(targetPath: string) {
    try {
        await fsp.access(targetPath)
        return true
    } catch {
        return false
    }
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

function createRepoIndex(baseDir: string, rootDir: string): RepoIndex {
    return {
        baseDir,
        rootDir,
        folders: new Map(),
        tests: new Map(),
        folderChildren: new Map(),
        testChildren: new Map(),
        sharedStepsJson: '[]',
    }
}

function rememberChild(children: Map<string, Set<string>>, parentId: string | null, childId: string) {
    if (!parentId) return
    const current = children.get(parentId)
    if (current) {
        current.add(childId)
        return
    }
    children.set(parentId, new Set([childId]))
}

function forgetChild(children: Map<string, Set<string>>, parentId: string | null, childId: string) {
    if (!parentId) return
    const current = children.get(parentId)
    if (!current) return
    current.delete(childId)
    if (!current.size) children.delete(parentId)
}

function setFolderEntry(index: RepoIndex, entry: RepoFolderEntry) {
    const previous = index.folders.get(entry.id)
    if (!previous || previous.parentId !== entry.parentId) {
        forgetChild(index.folderChildren, previous?.parentId ?? null, entry.id)
        rememberChild(index.folderChildren, entry.parentId, entry.id)
    }
    index.folders.set(entry.id, entry)
}

function setTestEntry(index: RepoIndex, entry: RepoTestEntry) {
    const previous = index.tests.get(entry.id)
    if (!previous || previous.parentId !== entry.parentId) {
        forgetChild(index.testChildren, previous?.parentId ?? null, entry.id)
        rememberChild(index.testChildren, entry.parentId, entry.id)
    }
    index.tests.set(entry.id, entry)
}

function removeTestEntry(index: RepoIndex, testId: string) {
    const existing = index.tests.get(testId)
    if (!existing) return
    forgetChild(index.testChildren, existing.parentId, testId)
    index.tests.delete(testId)
}

function removeFolderSubtree(index: RepoIndex, folderId: string) {
    for (const childTestId of [...(index.testChildren.get(folderId) ?? new Set<string>())]) {
        removeTestEntry(index, childTestId)
    }
    for (const childFolderId of [...(index.folderChildren.get(folderId) ?? new Set<string>())]) {
        removeFolderSubtree(index, childFolderId)
    }

    const existing = index.folders.get(folderId)
    if (existing) forgetChild(index.folderChildren, existing.parentId, folderId)
    index.folderChildren.delete(folderId)
    index.testChildren.delete(folderId)
    index.folders.delete(folderId)
}

function replacePathPrefix(currentPath: string, fromPath: string, toPath: string) {
    if (currentPath === fromPath) return toPath
    const prefix = `${fromPath}${path.sep}`
    return currentPath.startsWith(prefix) ? `${toPath}${currentPath.slice(fromPath.length)}` : currentPath
}

function updateFolderSubtreePaths(index: RepoIndex, folderId: string, fromPath: string, toPath: string) {
    const folderEntry = index.folders.get(folderId)
    if (folderEntry) {
        setFolderEntry(index, {
            ...folderEntry,
            path: replacePathPrefix(folderEntry.path, fromPath, toPath),
        })
    }

    for (const testId of index.testChildren.get(folderId) ?? []) {
        const testEntry = index.tests.get(testId)
        if (!testEntry) continue
        setTestEntry(index, {
            ...testEntry,
            path: replacePathPrefix(testEntry.path, fromPath, toPath),
        })
    }

    for (const childFolderId of index.folderChildren.get(folderId) ?? []) {
        updateFolderSubtreePaths(index, childFolderId, fromPath, toPath)
    }
}

function serializeFolderMeta(folder: Pick<Folder, 'id' | 'name'>) {
    return JSON.stringify({ id: folder.id, name: folder.name }, null, 2)
}

function serializeTestFile(test: TestCase) {
    return JSON.stringify(normalizeTestCase(test), null, 2)
}

function serializeSharedSteps(sharedSteps: SharedStep[]) {
    return JSON.stringify(sharedSteps.map((shared) => normalizeSharedStep(shared)), null, 2)
}

async function moveDirectory(currentPath: string, targetPath: string) {
    if (currentPath === targetPath) return

    await ensureDir(path.dirname(targetPath))

    const currentExists = await pathExists(currentPath)
    if (!currentExists) {
        await ensureDir(targetPath)
        return
    }

    if (await pathExists(targetPath)) {
        await fsp.rm(targetPath, { recursive: true, force: true })
    }

    await fsp.rename(currentPath, targetPath)
}

async function deleteFolderDir(index: RepoIndex, folderId: string) {
    const entry = index.folders.get(folderId)
    if (entry) {
        await fsp.rm(entry.path, { recursive: true, force: true })
    }
    removeFolderSubtree(index, folderId)
}

async function deleteTestDir(index: RepoIndex, testId: string) {
    const entry = index.tests.get(testId)
    if (entry) {
        await fsp.rm(entry.path, { recursive: true, force: true })
    }
    removeTestEntry(index, testId)
}

async function readRepoState(baseDir: string): Promise<{ state: RootState; index: RepoIndex }> {
    const rootDir = joinInside(baseDir, ROOT_DIR)
    await ensureDir(rootDir)
    const index = createRepoIndex(baseDir, rootDir)

    async function readNode(dir: string, fallbackName: string, parentId: string | null): Promise<Folder | TestCase> {
        const safeDir = assertPathInside(baseDir, dir)
        const entries = await fsp.readdir(safeDir)

        if (isTestFolder(entries)) {
            const normalized = normalizeTestCase(await readJsonFileStrict(joinInside(safeDir, TEST_FILE)))
            setTestEntry(index, {
                id: normalized.id,
                path: safeDir,
                parentId: parentId ?? '',
                contentJson: serializeTestFile(normalized),
            })
            return normalized
        }

        const meta = await readFolderMeta(safeDir)
        const folder: Folder = {
            id: typeof meta?.id === 'string' && meta.id.trim() ? meta.id : randomUUID(),
            name: typeof meta?.name === 'string' && meta.name.trim() ? meta.name : fallbackName,
            children: [],
        }

        setFolderEntry(index, {
            id: folder.id,
            path: safeDir,
            parentId,
            name: folder.name,
            metaJson: serializeFolderMeta(folder),
        })

        for (const entry of entries) {
            const childPath = joinInside(safeDir, entry)
            const stat = await fsp.lstat(childPath)
            if (!stat.isDirectory()) continue
            folder.children.push(await readNode(childPath, entry, folder.id))
        }

        return folder
    }

    const root = await readNode(rootDir, 'Root', null)
    const sharedSteps = await loadSharedSteps(baseDir)
    index.sharedStepsJson = serializeSharedSteps(sharedSteps)

    return {
        state: normalizeRootState({ root: root as Folder, sharedSteps }),
        index,
    }
}

async function ensureRepoIndex(baseDir: string, rootDir: string) {
    if (repoIndexCache && repoIndexCache.baseDir === baseDir && repoIndexCache.rootDir === rootDir) {
        return repoIndexCache
    }

    const { index } = await readRepoState(baseDir)
    repoIndexCache = index
    return index
}

async function syncTest(index: RepoIndex, test: TestCase, parentFolderId: string, parentPath: string) {
    const desiredPath = joinInside(parentPath, safeNodeDirName(test.name, test.id, 'test'))
    const previous = index.tests.get(test.id)

    if (previous && previous.path !== desiredPath) {
        await moveDirectory(previous.path, desiredPath)
    }

    await ensureDir(desiredPath)
    await ensureDir(joinInside(desiredPath, ATTACHMENTS_DIR))

    const contentJson = serializeTestFile(test)
    const testFilePath = joinInside(desiredPath, TEST_FILE)
    if (
        !previous ||
        previous.path !== desiredPath ||
        previous.parentId !== parentFolderId ||
        previous.contentJson !== contentJson ||
        !(await pathExists(testFilePath))
    ) {
        await fsp.writeFile(testFilePath, contentJson, 'utf-8')
    }

    setTestEntry(index, {
        id: test.id,
        path: desiredPath,
        parentId: parentFolderId,
        contentJson,
    })
}

async function syncFolder(index: RepoIndex, folder: Folder, parentId: string | null, parentPath: string | null) {
    const desiredPath = parentPath
        ? joinInside(parentPath, safeNodeDirName(folder.name, folder.id, 'folder'))
        : index.rootDir

    let previous = index.folders.get(folder.id)
    if (previous && previous.path !== desiredPath) {
        await moveDirectory(previous.path, desiredPath)
        updateFolderSubtreePaths(index, folder.id, previous.path, desiredPath)
        previous = index.folders.get(folder.id)
    }

    await ensureDir(desiredPath)

    const metaJson = serializeFolderMeta(folder)
    const metaPath = joinInside(desiredPath, FOLDER_META_FILE)
    if (
        !previous ||
        previous.path !== desiredPath ||
        previous.parentId !== parentId ||
        previous.name !== folder.name ||
        previous.metaJson !== metaJson ||
        !(await pathExists(metaPath))
    ) {
        await fsp.writeFile(metaPath, metaJson, 'utf-8')
    }

    setFolderEntry(index, {
        id: folder.id,
        path: desiredPath,
        parentId,
        name: folder.name,
        metaJson,
    })

    const desiredFolderIds = new Set<string>()
    const desiredTestIds = new Set<string>()

    for (const child of folder.children) {
        if ('children' in child) {
            desiredFolderIds.add(child.id)
            await syncFolder(index, child, folder.id, desiredPath)
            continue
        }

        desiredTestIds.add(child.id)
        await syncTest(index, child, folder.id, desiredPath)
    }

    for (const childFolderId of [...(index.folderChildren.get(folder.id) ?? new Set<string>())]) {
        if (!desiredFolderIds.has(childFolderId)) {
            await deleteFolderDir(index, childFolderId)
        }
    }

    for (const childTestId of [...(index.testChildren.get(folder.id) ?? new Set<string>())]) {
        if (!desiredTestIds.has(childTestId)) {
            await deleteTestDir(index, childTestId)
        }
    }
}

export async function loadFromFs(): Promise<RootState> {
    const baseDir = getRepoDir()
    const { state, index } = await readRepoState(baseDir)
    repoIndexCache = index
    return state
}

export async function saveToFs(state: RootState) {
    const normalized = normalizeRootState(state)
    const baseDir = getRepoDir()
    const rootDir = joinInside(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    const index = await ensureRepoIndex(baseDir, rootDir)
    await syncFolder(index, normalized.root, null, null)

    const sharedStepsJson = serializeSharedSteps(normalized.sharedSteps)
    const sharedStepsPath = joinInside(baseDir, SHARED_STEPS_FILE)
    if (index.sharedStepsJson !== sharedStepsJson || !(await pathExists(sharedStepsPath))) {
        await fsp.writeFile(sharedStepsPath, sharedStepsJson, 'utf-8')
    }
    index.sharedStepsJson = sharedStepsJson

    repoIndexCache = index
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
