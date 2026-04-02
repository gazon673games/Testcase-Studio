import { describe, expect, it } from 'vitest'
import { getImportDestination, getPublishSelection } from './queries'
import { makeWorkspace } from './testSupport'

describe('workspace selection queries', () => {
    it('returns the parent folder as import destination when a test is selected', () => {
        const { state, childFolder, folderTest } = makeWorkspace()

        const destination = getImportDestination(state, folderTest.id, 'Workspace')

        expect(destination.folderId).toBe(childFolder.id)
        expect(destination.label).toBe('Root / Billing')
    })

    it('returns the root label when state is not loaded yet', () => {
        const destination = getImportDestination(null, null, 'Workspace')

        expect(destination).toEqual({ folderId: '', label: 'Workspace' })
    })

    it('returns only the selected test when publishing a single test', () => {
        const { state, folderTest } = makeWorkspace()

        const selection = getPublishSelection(state, folderTest.id, 'Workspace')

        expect(selection.label).toBe(folderTest.name)
        expect(selection.tests).toEqual([folderTest])
    })

    it('uses the caller-facing root label for whole-workspace publish selection', () => {
        const { state, rootTest, folderTest } = makeWorkspace()

        const selection = getPublishSelection(state, null, 'Workspace')

        expect(selection.label).toBe('Workspace')
        expect(selection.tests).toEqual(expect.arrayContaining([rootTest, folderTest]))
    })
})
