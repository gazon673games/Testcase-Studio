import type { Folder, ID, TestCase } from './domain'

export type Node = Folder | TestCase

function getNodeId(node: Node): ID {
    return node.id
}

function findChildIndexById(folder: Folder, childId: ID): number {
    return folder.children.findIndex((child) => getNodeId(child) === childId)
}

function walkFolders(root: Folder, visit: (folder: Folder) => boolean | void): boolean {
    const foldersToVisit: Folder[] = [root]

    while (foldersToVisit.length > 0) {
        const currentFolder = foldersToVisit.pop()!
        if (visit(currentFolder)) return true

        for (let index = currentFolder.children.length - 1; index >= 0; index -= 1) {
            const child = currentFolder.children[index]
            if (isFolder(child)) foldersToVisit.push(child)
        }
    }

    return false
}

function findFolderById(root: Folder, folderId: ID): Folder | null {
    let matchedFolder: Folder | null = null

    walkFolders(root, (folder) => {
        if (folder.id !== folderId) return false
        matchedFolder = folder
        return true
    })

    return matchedFolder
}

export function isFolder(node: Node): node is Folder {
    return (node as Folder).children !== undefined
}

export function findNode(root: Folder, id: ID): Node | null {
    if (root.id === id) return root

    let matchedNode: Node | null = null

    walkFolders(root, (folder) => {
        const childIndex = findChildIndexById(folder, id)
        if (childIndex < 0) return false
        matchedNode = folder.children[childIndex]
        return true
    })

    return matchedNode
}

export function mutateFolder(root: Folder, id: ID, mutate: (folder: Folder) => void): boolean {
    const folder = findFolderById(root, id)
    if (!folder) return false

    mutate(folder)
    return true
}

export function insertChild(root: Folder, parentId: ID, child: Node): boolean {
    return mutateFolder(root, parentId, (folder) => {
        folder.children.push(child)
    })
}

export function deleteNode(root: Folder, targetId: ID): boolean {
    let deleted = false

    walkFolders(root, (folder) => {
        const childIndex = findChildIndexById(folder, targetId)
        if (childIndex < 0) return false

        folder.children.splice(childIndex, 1)
        deleted = true
        return true
    })

    return deleted
}

export function mapTests(root: Folder): TestCase[] {
    const tests: TestCase[] = []

    walkFolders(root, (folder) => {
        for (const child of folder.children) {
            if (!isFolder(child)) tests.push(child)
        }
    })

    return tests
}

export function findParentFolder(root: Folder, childId: ID): Folder | null {
    let parentFolder: Folder | null = null

    walkFolders(root, (folder) => {
        if (findChildIndexById(folder, childId) < 0) return false
        parentFolder = folder
        return true
    })

    return parentFolder
}

export function isAncestor(root: Folder, ancestorId: ID, descendantId: ID): boolean {
    let currentParent = findParentFolder(root, descendantId)

    while (currentParent) {
        if (currentParent.id === ancestorId) return true
        currentParent = findParentFolder(root, currentParent.id)
    }

    return false
}

export function moveNode(root: Folder, nodeId: ID, targetFolderId: ID): boolean {
    if (nodeId === root.id) return false
    if (nodeId === targetFolderId) return false

    const node = findNode(root, nodeId)
    if (!node) return false
    if (isAncestor(root, nodeId, targetFolderId)) return false

    const sourceFolder = findParentFolder(root, nodeId)
    if (!sourceFolder) return false

    const sourceIndex = findChildIndexById(sourceFolder, nodeId)
    if (sourceIndex < 0) return false

    sourceFolder.children.splice(sourceIndex, 1)
    return mutateFolder(root, targetFolderId, (targetFolder) => {
        targetFolder.children.push(node)
    })
}
