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
        label: describeFolderPath(state.root, folder.id),
    }
}

export function getPublishSelection(state: RootState | null, selectedId: ID | null, rootLabel: string) {
    if (!state) return { label: rootLabel, tests: [] as TestCase[] }

    const selected = getSelectedNode(state, selectedId)
    if (!selected) return { label: describeFolderPath(state.root, state.root.id), tests: mapTests(state.root) }
    if (!isFolder(selected)) return { label: selected.name, tests: [selected] }

    return {
        label: describeFolderPath(state.root, selected.id),
        tests: mapTests(selected),
    }
}
