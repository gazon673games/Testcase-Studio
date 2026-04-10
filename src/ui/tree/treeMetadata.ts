import type { Folder, TestCase } from '@core/domain'
import { isFolder } from '@core/tree'
import { getStoredFolderAlias, getStoredTestAlias } from '@shared/treeAliases'
import { getStoredFolderIconKey, getStoredTestIconKey } from '@shared/treeIcons'

export function collectFolderIconKeys(root: Folder) {
    const icons = new Map<string, string | null>()

    const visit = (folder: Folder) => {
        icons.set(folder.id, getStoredFolderIconKey(folder))
        for (const child of folder.children) {
            if (isFolder(child)) visit(child)
        }
    }

    visit(root)
    return icons
}

export function collectFolderAliases(root: Folder) {
    const aliases = new Map<string, string | null>()

    const visit = (folder: Folder) => {
        aliases.set(folder.id, getStoredFolderAlias(folder))
        for (const child of folder.children) {
            if (isFolder(child)) visit(child)
        }
    }

    visit(root)
    return aliases
}

export function collectTestIconKeys(tests: TestCase[]) {
    const icons = new Map<string, string | null>()
    for (const test of tests) icons.set(test.id, getStoredTestIconKey(test.details))
    return icons
}

export function collectTestAliases(tests: TestCase[]) {
    const aliases = new Map<string, string | null>()
    for (const test of tests) aliases.set(test.id, getStoredTestAlias(test.details))
    return aliases
}

export function collectAncestorFolderIds(root: Folder, targetId: string): string[] {
    const trail: string[] = []

    const walk = (folder: Folder, ancestors: string[]): boolean => {
        if (folder.id === targetId) {
            trail.push(...ancestors)
            return true
        }

        for (const child of folder.children) {
            if (child.id === targetId) {
                trail.push(...ancestors, folder.id)
                return true
            }
            if (!isFolder(child)) continue
            if (walk(child, [...ancestors, folder.id])) return true
        }

        return false
    }

    walk(root, [])
    return trail
}
