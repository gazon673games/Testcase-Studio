import { promises as fsp } from 'fs'
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
import { createRepoIndex, setFolderEntry, setTestEntry } from './repoIndex'
import {
    FOLDER_META_FILE,
    ROOT_DIR,
    SHARED_STEPS_FILE,
    TEST_FILE,
    assertPathInside,
    ensureDir,
    isTestFolder,
    joinInside,
    readJsonFile,
    readJsonFileStrict,
    serializeFolderMeta,
    serializeSharedSteps,
    serializeTestFile,
    type RepoIndex,
} from './repoShared'

async function readFolderMetaFile(folderPath: string): Promise<{ id?: string; name?: string } | null> {
    return readJsonFile<{ id?: string; name?: string }>(joinInside(folderPath, FOLDER_META_FILE))
}

async function readSharedStepsFile(baseDir: string) {
    const sharedStepsPath = joinInside(baseDir, SHARED_STEPS_FILE)

    try {
        const rawSharedSteps = await readJsonFileStrict<Array<Partial<SharedStep>>>(sharedStepsPath)
        return Array.isArray(rawSharedSteps)
            ? rawSharedSteps.map((sharedStep) => normalizeSharedStep(sharedStep))
            : []
    } catch (error) {
        const fileError = error as NodeJS.ErrnoException
        if (fileError?.code === 'ENOENT') return []
        throw error
    }
}

async function readNodeFromDisk(
    index: RepoIndex,
    baseDir: string,
    nodePath: string,
    fallbackFolderName: string,
    parentFolderId: string | null
): Promise<Folder | TestCase> {
    const safeNodePath = assertPathInside(baseDir, nodePath)
    const entryNames = await fsp.readdir(safeNodePath)

    if (isTestFolder(entryNames)) {
        const normalizedTest = normalizeTestCase(await readJsonFileStrict(joinInside(safeNodePath, TEST_FILE)))
        setTestEntry(index, {
            id: normalizedTest.id,
            path: safeNodePath,
            parentId: parentFolderId ?? '',
            contentJson: serializeTestFile(normalizedTest),
        })
        return normalizedTest
    }

    const folderMeta = await readFolderMetaFile(safeNodePath)
    const folder: Folder = {
        id: typeof folderMeta?.id === 'string' && folderMeta.id.trim() ? folderMeta.id : randomUUID(),
        name: typeof folderMeta?.name === 'string' && folderMeta.name.trim() ? folderMeta.name : fallbackFolderName,
        children: [],
    }

    setFolderEntry(index, {
        id: folder.id,
        path: safeNodePath,
        parentId: parentFolderId,
        name: folder.name,
        metaJson: serializeFolderMeta(folder),
    })

    for (const entryName of entryNames) {
        const childPath = joinInside(safeNodePath, entryName)
        const childStat = await fsp.lstat(childPath)
        if (!childStat.isDirectory()) continue

        folder.children.push(await readNodeFromDisk(index, baseDir, childPath, entryName, folder.id))
    }

    return folder
}

export async function readRepoState(baseDir: string): Promise<{ state: RootState; index: RepoIndex }> {
    const rootDir = joinInside(baseDir, ROOT_DIR)
    await ensureDir(rootDir)

    const index = createRepoIndex(baseDir, rootDir)
    const rootNode = await readNodeFromDisk(index, baseDir, rootDir, 'Root', null)
    const sharedSteps = await readSharedStepsFile(baseDir)

    index.sharedStepsJson = serializeSharedSteps(sharedSteps)

    return {
        state: normalizeRootState({ root: rootNode as Folder, sharedSteps }),
        index,
    }
}
