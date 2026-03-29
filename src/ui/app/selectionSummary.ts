import type { Folder, TestCase } from '@core/domain'
import { describeFolderPath } from '@app/sync'
import { findParentFolder, isFolder } from '@core/tree'

export type SelectionSummary = {
    kind: 'none' | 'root' | 'folder' | 'test'
    title: string
    subtitle: string
    pathLabel: string
    folderCount: number
    testCount: number
    directChildrenCount: number
}

export function buildSelectionSummary(
    root: Folder,
    selected: Folder | TestCase | null,
    t: (key: any, params?: Record<string, string | number>) => string
): SelectionSummary {
    if (!selected) {
        return {
            kind: 'none',
            title: t('toolbar.editor'),
            subtitle: t('toolbar.syncCenterTitle'),
            pathLabel: describeFolderPath(root, root.id),
            folderCount: countNestedFolders(root),
            testCount: countTests(root),
            directChildrenCount: root.children.length,
        }
    }

    if (isFolder(selected)) {
        const isRoot = selected.id === root.id
        return {
            kind: isRoot ? 'root' : 'folder',
            title: isRoot ? t('overview.zephyrWorkspace') : selected.name,
            subtitle: isRoot ? t('overview.importFromZephyrDescription') : t('sync.publishScopeHint'),
            pathLabel: describeFolderPath(root, selected.id),
            folderCount: countNestedFolders(selected),
            testCount: countTests(selected),
            directChildrenCount: selected.children.length,
        }
    }

    const parentId = findParentFolder(root, selected.id)?.id ?? root.id
    return {
        kind: 'test',
        title: selected.name,
        subtitle: t('editor.testCase'),
        pathLabel: `${describeFolderPath(root, parentId)} / ${selected.name}`,
        folderCount: 0,
        testCount: 1,
        directChildrenCount: selected.steps.length,
    }
}

function countTests(folder: Folder): number {
    let total = 0
    for (const child of folder.children) {
        if (isFolder(child)) total += countTests(child)
        else total += 1
    }
    return total
}

function countNestedFolders(folder: Folder): number {
    let total = 0
    for (const child of folder.children) {
        if (!isFolder(child)) continue
        total += 1
        total += countNestedFolders(child)
    }
    return total
}
