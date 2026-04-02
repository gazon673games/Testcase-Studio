import { promises as fsp } from 'fs'
import path from 'node:path'
import { type Folder, type SharedStep, type TestCase } from '../../src/core/domain'
import { removeFolderSubtree, removeTestEntry, setFolderEntry, setTestEntry, updateFolderSubtreePaths } from './repoIndex'
import {
    ATTACHMENTS_DIR,
    FOLDER_META_FILE,
    SHARED_STEPS_FILE,
    TEST_FILE,
    ensureDir,
    joinInside,
    pathExists,
    safeNodeDirName,
    serializeFolderMeta,
    serializeSharedSteps,
    serializeTestFile,
    type RepoIndex,
} from './repoShared'

async function moveDirectory(currentPath: string, nextPath: string) {
    if (currentPath === nextPath) return

    await ensureDir(path.dirname(nextPath))

    const currentExists = await pathExists(currentPath)
    if (!currentExists) {
        await ensureDir(nextPath)
        return
    }

    if (await pathExists(nextPath)) {
        await fsp.rm(nextPath, { recursive: true, force: true })
    }

    await fsp.rename(currentPath, nextPath)
}

async function deleteFolderEntryFromDisk(index: RepoIndex, folderId: string) {
    const folderEntry = index.folders.get(folderId)
    if (folderEntry) {
        await fsp.rm(folderEntry.path, { recursive: true, force: true })
    }

    removeFolderSubtree(index, folderId)
}

async function deleteTestEntryFromDisk(index: RepoIndex, testId: string) {
    const testEntry = index.tests.get(testId)
    if (testEntry) {
        await fsp.rm(testEntry.path, { recursive: true, force: true })
    }

    removeTestEntry(index, testId)
}

async function syncTestNode(index: RepoIndex, test: TestCase, parentFolderId: string, parentFolderPath: string) {
    const desiredTestPath = joinInside(parentFolderPath, safeNodeDirName(test.name, test.id, 'test'))
    const previousEntry = index.tests.get(test.id)

    if (previousEntry && previousEntry.path !== desiredTestPath) {
        await moveDirectory(previousEntry.path, desiredTestPath)
    }

    await ensureDir(desiredTestPath)
    await ensureDir(joinInside(desiredTestPath, ATTACHMENTS_DIR))

    const contentJson = serializeTestFile(test)
    const testFilePath = joinInside(desiredTestPath, TEST_FILE)
    const shouldWriteFile = !previousEntry
        || previousEntry.path !== desiredTestPath
        || previousEntry.parentId !== parentFolderId
        || previousEntry.contentJson !== contentJson
        || !(await pathExists(testFilePath))

    if (shouldWriteFile) {
        await fsp.writeFile(testFilePath, contentJson, 'utf-8')
    }

    setTestEntry(index, {
        id: test.id,
        path: desiredTestPath,
        parentId: parentFolderId,
        contentJson,
    })
}

export async function syncFolderNode(
    index: RepoIndex,
    folder: Folder,
    parentFolderId: string | null,
    parentFolderPath: string | null
) {
    const desiredFolderPath = parentFolderPath
        ? joinInside(parentFolderPath, safeNodeDirName(folder.name, folder.id, 'folder'))
        : index.rootDir

    let previousEntry = index.folders.get(folder.id)
    if (previousEntry && previousEntry.path !== desiredFolderPath) {
        await moveDirectory(previousEntry.path, desiredFolderPath)
        updateFolderSubtreePaths(index, folder.id, previousEntry.path, desiredFolderPath)
        previousEntry = index.folders.get(folder.id)
    }

    await ensureDir(desiredFolderPath)

    const metaJson = serializeFolderMeta(folder)
    const folderMetaPath = joinInside(desiredFolderPath, FOLDER_META_FILE)
    const shouldWriteMeta = !previousEntry
        || previousEntry.path !== desiredFolderPath
        || previousEntry.parentId !== parentFolderId
        || previousEntry.name !== folder.name
        || previousEntry.metaJson !== metaJson
        || !(await pathExists(folderMetaPath))

    if (shouldWriteMeta) {
        await fsp.writeFile(folderMetaPath, metaJson, 'utf-8')
    }

    setFolderEntry(index, {
        id: folder.id,
        path: desiredFolderPath,
        parentId: parentFolderId,
        name: folder.name,
        metaJson,
    })

    const desiredChildFolderIds = new Set<string>()
    const desiredChildTestIds = new Set<string>()

    for (const childNode of folder.children) {
        if ('children' in childNode) {
            desiredChildFolderIds.add(childNode.id)
            await syncFolderNode(index, childNode, folder.id, desiredFolderPath)
            continue
        }

        desiredChildTestIds.add(childNode.id)
        await syncTestNode(index, childNode, folder.id, desiredFolderPath)
    }

    for (const childFolderId of [...(index.folderChildren.get(folder.id) ?? new Set<string>())]) {
        if (!desiredChildFolderIds.has(childFolderId)) {
            await deleteFolderEntryFromDisk(index, childFolderId)
        }
    }

    for (const childTestId of [...(index.testChildren.get(folder.id) ?? new Set<string>())]) {
        if (!desiredChildTestIds.has(childTestId)) {
            await deleteTestEntryFromDisk(index, childTestId)
        }
    }
}

export async function writeSharedStepsFile(index: RepoIndex, sharedSteps: SharedStep[]) {
    const nextSharedStepsJson = serializeSharedSteps(sharedSteps)
    const sharedStepsPath = joinInside(index.baseDir, SHARED_STEPS_FILE)

    if (index.sharedStepsJson !== nextSharedStepsJson || !(await pathExists(sharedStepsPath))) {
        await fsp.writeFile(sharedStepsPath, nextSharedStepsJson, 'utf-8')
    }

    index.sharedStepsJson = nextSharedStepsJson
}
