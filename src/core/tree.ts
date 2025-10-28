import type { Folder, TestCase, ID } from './domain'

export type Node = Folder | TestCase

export function isFolder(n: Node): n is Folder {
    return (n as Folder).children !== undefined
}

export function findNode(root: Folder, id: ID): Node | null {
    if (root.id === id) return root
    for (const child of root.children) {
        if (isFolder(child)) {
            const hit = findNode(child, id)
            if (hit) return hit
        } else if (child.id === id) {
            return child
        }
    }
    return null
}

export function mutateFolder(root: Folder, id: ID, fn: (f: Folder) => void): boolean {
    if (root.id === id) { fn(root); return true }
    for (const child of root.children) {
        if (isFolder(child) && mutateFolder(child, id, fn)) return true
    }
    return false
}

export function insertChild(root: Folder, parentId: ID, child: Node): boolean {
    return mutateFolder(root, parentId, (f) => f.children.push(child))
}

export function deleteNode(root: Folder, targetId: ID): boolean {
    const stack: Folder[] = [root]
    while (stack.length) {
        const f = stack.pop()!
        const idx = f.children.findIndex(c => (isFolder(c) ? c.id : (c as TestCase).id) === targetId)
        if (idx >= 0) { f.children.splice(idx, 1); return true }
        for (const c of f.children) if (isFolder(c)) stack.push(c)
    }
    return false
}

export function mapTests(root: Folder): TestCase[] {
    const res: TestCase[] = []
    const dfs = (f: Folder) => {
        for (const c of f.children) {
            if (isFolder(c)) dfs(c)
            else res.push(c)
        }
    }
    dfs(root)
    return res
}

export function findParentFolder(root: Folder, childId: ID): Folder | null {
    const stack: Folder[] = [root]
    while (stack.length) {
        const f = stack.pop()!
        for (const c of f.children) {
            const id = isFolder(c) ? c.id : (c as TestCase).id
            if (id === childId) return f
            if (isFolder(c)) stack.push(c)
        }
    }
    return null
}

/** Узел А — предок узла B? */
export function isAncestor(root: Folder, aId: ID, bId: ID): boolean {
    const parent = findParentFolder(root, bId)
    if (!parent) return false
    if (parent.id === aId) return true
    return isAncestor(root, aId, parent.id)
}

/** Переместить узел (папку или тест) в другую папку. Возвращает true, если получилось. */
export function moveNode(root: Folder, nodeId: ID, targetFolderId: ID): boolean {
    if (nodeId === root.id) return false
    if (nodeId === targetFolderId) return false
    const node = findNode(root, nodeId)
    if (!node) return false
    // нельзя переносить в собственный поддерево
    if (isAncestor(root, nodeId, targetFolderId)) return false

    const parent = findParentFolder(root, nodeId)
    if (!parent) return false
    const idx = parent.children.findIndex(c => (isFolder(c) ? c.id : (c as TestCase).id) === nodeId)
    if (idx < 0) return false
    parent.children.splice(idx, 1)
    return mutateFolder(root, targetFolderId, (f) => f.children.push(node))
}
