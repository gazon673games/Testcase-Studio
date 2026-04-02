import { describe, expect, it } from 'vitest'
import { mkFolder, mkTest } from './domain'
import { deleteNode, findNode, findParentFolder, insertChild, isAncestor, mapTests, moveNode, mutateFolder } from './tree'

function buildTree() {
    const root = mkFolder('Root')
    root.id = 'root'

    const leftFolder = mkFolder('Left')
    leftFolder.id = 'folder-left'

    const rightFolder = mkFolder('Right')
    rightFolder.id = 'folder-right'

    const nestedFolder = mkFolder('Nested')
    nestedFolder.id = 'folder-nested'

    const alpha = mkTest('Alpha')
    alpha.id = 'test-alpha'

    const beta = mkTest('Beta')
    beta.id = 'test-beta'

    const gamma = mkTest('Gamma')
    gamma.id = 'test-gamma'

    nestedFolder.children.push(beta)
    leftFolder.children.push(alpha, nestedFolder)
    rightFolder.children.push(gamma)
    root.children.push(leftFolder, rightFolder)

    return { root, leftFolder, rightFolder, nestedFolder, alpha, beta, gamma }
}

describe('tree helpers', () => {
    it('finds nested nodes and maps tests in traversal order', () => {
        const { root, nestedFolder, beta, gamma } = buildTree()

        expect(findNode(root, nestedFolder.id)).toBe(nestedFolder)
        expect(findNode(root, beta.id)).toBe(beta)
        expect(findNode(root, 'missing')).toBeNull()
        expect(mapTests(root).map((test) => test.id)).toEqual(['test-alpha', 'test-beta', 'test-gamma'])
    })

    it('mutates and inserts children through folder helpers', () => {
        const { root, leftFolder } = buildTree()
        const extra = mkTest('Extra')
        extra.id = 'test-extra'

        expect(mutateFolder(root, leftFolder.id, (folder) => {
            folder.name = 'Left updated'
        })).toBe(true)
        expect(leftFolder.name).toBe('Left updated')

        expect(insertChild(root, leftFolder.id, extra)).toBe(true)
        expect(findParentFolder(root, extra.id)?.id).toBe(leftFolder.id)
    })

    it('finds parents, checks ancestry, and deletes nested nodes', () => {
        const { root, leftFolder, nestedFolder, beta } = buildTree()

        expect(findParentFolder(root, beta.id)?.id).toBe(nestedFolder.id)
        expect(isAncestor(root, leftFolder.id, beta.id)).toBe(true)
        expect(isAncestor(root, nestedFolder.id, leftFolder.id)).toBe(false)

        expect(deleteNode(root, beta.id)).toBe(true)
        expect(findNode(root, beta.id)).toBeNull()
    })

    it('moves nodes between folders and blocks moving a folder into its own subtree', () => {
        const { root, leftFolder, rightFolder, nestedFolder, alpha } = buildTree()

        expect(moveNode(root, alpha.id, rightFolder.id)).toBe(true)
        expect(findParentFolder(root, alpha.id)?.id).toBe(rightFolder.id)

        expect(moveNode(root, leftFolder.id, nestedFolder.id)).toBe(false)
        expect(findParentFolder(root, nestedFolder.id)?.id).toBe(leftFolder.id)
    })
})
