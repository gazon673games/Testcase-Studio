import path from 'node:path'
import type { RepoFolderEntry, RepoIndex, RepoTestEntry } from './repoShared'

export function createRepoIndex(baseDir: string, rootDir: string): RepoIndex {
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

function rememberChildId(childrenByParent: Map<string, Set<string>>, parentId: string | null, childId: string) {
    if (!parentId) return

    const existing = childrenByParent.get(parentId)
    if (existing) {
        existing.add(childId)
        return
    }

    childrenByParent.set(parentId, new Set([childId]))
}

function forgetChildId(childrenByParent: Map<string, Set<string>>, parentId: string | null, childId: string) {
    if (!parentId) return

    const existing = childrenByParent.get(parentId)
    if (!existing) return

    existing.delete(childId)
    if (!existing.size) childrenByParent.delete(parentId)
}

export function setFolderEntry(index: RepoIndex, folderEntry: RepoFolderEntry) {
    const previousEntry = index.folders.get(folderEntry.id)

    if (!previousEntry || previousEntry.parentId !== folderEntry.parentId) {
        forgetChildId(index.folderChildren, previousEntry?.parentId ?? null, folderEntry.id)
        rememberChildId(index.folderChildren, folderEntry.parentId, folderEntry.id)
    }

    index.folders.set(folderEntry.id, folderEntry)
}

export function setTestEntry(index: RepoIndex, testEntry: RepoTestEntry) {
    const previousEntry = index.tests.get(testEntry.id)

    if (!previousEntry || previousEntry.parentId !== testEntry.parentId) {
        forgetChildId(index.testChildren, previousEntry?.parentId ?? null, testEntry.id)
        rememberChildId(index.testChildren, testEntry.parentId, testEntry.id)
    }

    index.tests.set(testEntry.id, testEntry)
}

export function removeTestEntry(index: RepoIndex, testId: string) {
    const existingEntry = index.tests.get(testId)
    if (!existingEntry) return

    forgetChildId(index.testChildren, existingEntry.parentId, testId)
    index.tests.delete(testId)
}

export function removeFolderSubtree(index: RepoIndex, folderId: string) {
    for (const childTestId of [...(index.testChildren.get(folderId) ?? new Set<string>())]) {
        removeTestEntry(index, childTestId)
    }

    for (const childFolderId of [...(index.folderChildren.get(folderId) ?? new Set<string>())]) {
        removeFolderSubtree(index, childFolderId)
    }

    const existingEntry = index.folders.get(folderId)
    if (existingEntry) forgetChildId(index.folderChildren, existingEntry.parentId, folderId)

    index.folderChildren.delete(folderId)
    index.testChildren.delete(folderId)
    index.folders.delete(folderId)
}

function replacePathPrefix(currentPath: string, fromPath: string, toPath: string) {
    if (currentPath === fromPath) return toPath

    const fromPrefix = `${fromPath}${path.sep}`
    return currentPath.startsWith(fromPrefix)
        ? `${toPath}${currentPath.slice(fromPath.length)}`
        : currentPath
}

export function updateFolderSubtreePaths(index: RepoIndex, folderId: string, fromPath: string, toPath: string) {
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
