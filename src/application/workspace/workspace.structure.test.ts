import { describe, expect, it } from 'vitest'
import { mkFolder } from '@core/domain'
import {
    addFolderFromSelection,
    addTestFromSelection,
    deleteNodeById,
    moveWorkspaceNode,
    renameWorkspaceNode,
} from './commands'
import { findNode, findParentFolder, isFolder } from '@core/tree'
import { makeWorkspace } from './testSupport'

describe('workspace structure', () => {
    it('adds a folder into the parent folder when a test is selected', () => {
        const { state, childFolder, folderTest } = makeWorkspace()

        const result = addFolderFromSelection(state, folderTest.id, 'Reports')
        const inserted = findNode(result.nextState.root, result.selectedId ?? '')

        expect(inserted && isFolder(inserted)).toBe(true)
        expect(inserted && isFolder(inserted) ? inserted.name : '').toBe('Reports')
        expect(findParentFolder(result.nextState.root, result.selectedId ?? '')?.id).toBe(childFolder.id)
    })

    it('adds a test into the parent folder and starts it with one editable step', () => {
        const { state, childFolder, folderTest } = makeWorkspace()

        const result = addTestFromSelection(state, folderTest.id, 'New case', 'Do first step')
        const inserted = findNode(result.nextState.root, result.selectedId ?? '')

        expect(inserted && !isFolder(inserted)).toBe(true)
        expect(inserted && !isFolder(inserted) ? inserted.steps.length : 0).toBe(1)
        expect(result.focusStepId).toBe(inserted && !isFolder(inserted) ? inserted.steps[0]?.id : null)
        expect(result.dirtyIds).toEqual(inserted && !isFolder(inserted) ? [inserted.id] : [])
        expect(findParentFolder(result.nextState.root, result.selectedId ?? '')?.id).toBe(childFolder.id)
    })

    it('renames folders without dirtying tests, but renaming a test marks that test dirty', () => {
        const { state, childFolder, rootTest } = makeWorkspace()

        const folderRename = renameWorkspaceNode(state, childFolder.id, 'Billing v2')
        const testRename = renameWorkspaceNode(state, rootTest.id, 'Root test v2')

        expect(folderRename?.dirtyIds).toBeUndefined()
        expect(findNode(folderRename?.nextState.root ?? state.root, childFolder.id)?.name).toBe('Billing v2')
        expect(testRename?.dirtyIds).toEqual([rootTest.id])
        expect(findNode(testRename?.nextState.root ?? state.root, rootTest.id)?.name).toBe('Root test v2')
    })

    it('allows renaming the root folder without dirtying tests', () => {
        const { state } = makeWorkspace()

        const result = renameWorkspaceNode(state, state.root.id, 'Workspace Alpha')

        expect(result?.dirtyIds).toBeUndefined()
        expect(result?.nextState.root.name).toBe('Workspace Alpha')
    })

    it('falls back to the root selection when the selected node is deleted', () => {
        const { state, folderTest } = makeWorkspace()

        const result = deleteNodeById(state, folderTest.id, folderTest.id)

        expect(result?.selectedId).toBe(state.root.id)
        expect(result?.focusStepId).toBeNull()
    })

    it('rejects moving a folder into its own descendant', () => {
        const { state, childFolder } = makeWorkspace()
        const nested = mkFolder('Nested')
        nested.id = 'folder-nested'
        childFolder.children.push(nested)

        const result = moveWorkspaceNode(state, childFolder.id, nested.id)

        expect(result.moved).toBe(false)
    })

    it('keeps the moved node selected after a successful move', () => {
        const { state, rootTest, childFolder } = makeWorkspace()

        const result = moveWorkspaceNode(state, rootTest.id, childFolder.id)

        expect(result.moved).toBe(true)
        expect(result.selectedId).toBe(rootTest.id)
        expect(findParentFolder(result.nextState.root, rootTest.id)?.id).toBe(childFolder.id)
    })
})
