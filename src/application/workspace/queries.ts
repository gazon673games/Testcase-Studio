import type { Folder, ID, RootState, TestCase } from '@core/domain'
import { findNode, findParentFolder, isFolder, mapTests } from '@core/tree'
import { describeFolderPath } from '@app/sync'

export type WorkspaceNode = Folder | TestCase

export function getSelectedNode(state: RootState | null, selectedId: ID | null): WorkspaceNode | null {
    if (!state || !selectedId) return null
    return findNode(state.root, selectedId) as WorkspaceNode | null
}

export function getImportDestination(state: RootState | null, selectedId: ID | null, rootLabel: string) {
    if (!state) return { folderId: '', label: rootLabel }

    const selected = getSelectedNode(state, selectedId)
    const folder =
        !selected
            ? state.root
            : isFolder(selected)
                ? selected
                : findParentFolder(state.root, selected.id) ?? state.root

    return {
        folderId: folder.id,
        label: describeFolderPath(state.root, folder.id, rootLabel),
    }
}

export function getPublishSelection(state: RootState | null, selectedId: ID | null, rootLabel: string) {
    if (!state) return { label: rootLabel, tests: [] as TestCase[] }

    const selected = getSelectedNode(state, selectedId)
    if (!selected) return { label: rootLabel, tests: mapTests(state.root) }
    if (!isFolder(selected)) return { label: selected.name, tests: [selected] }
    if (selected.id === state.root.id) return { label: rootLabel, tests: mapTests(state.root) }

    return {
        label: describeFolderPath(state.root, selected.id, rootLabel),
        tests: mapTests(selected),
    }
}

export function getTestById(state: RootState | null, testId: ID | null): TestCase | null {
    if (!state || !testId) return null
    const node = findNode(state.root, testId)
    return node && !isFolder(node) ? (node as TestCase) : null
}

export function getAllTests(state: RootState | null): TestCase[] {
    if (!state) return []
    return mapTests(state.root)
}

export function getSelectedFolder(state: RootState | null, selectedId: ID | null): Folder | null {
    if (!state) return null
    if (!selectedId) return state.root
    const node = findNode(state.root, selectedId)
    if (!node) return null
    return isFolder(node) ? node : null
}
