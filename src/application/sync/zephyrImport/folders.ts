import { mkFolder, type Folder } from '@core/domain'
import { findNode, isFolder } from '@core/tree'
import type { ProviderTest } from '@providers/types'
import { translate } from '@shared/i18n'
import type { ZephyrImportRequest } from './types'
import { remoteFolderValue } from './shared'

export function getConflictFolderName() {
    return translate('import.conflictFolder')
}

export function describeFolderPath(root: Folder, folderId: string): string {
    const labels = findFolderLabels(root, folderId)
    return labels.length ? labels.join(' / ') : translate('defaults.root')
}

export function buildTargetFolderSegments(remote: ProviderTest, request: ZephyrImportRequest): string[] {
    if (request.mirrorRemoteFolders === false && request.mode === 'keys') return []

    const remoteSegments = normalizeFolderSegments(remoteFolderValue(remote))
    if (!remoteSegments.length) return []

    let scoped = remoteSegments
    if (request.mode === 'project') {
        const projectKey = normalizeFolderLabel(request.projectKey)
        if (projectKey && normalizeFolderLabel(scoped[0]) === projectKey) scoped = scoped.slice(1)
    } else if (request.mode === 'folder') {
        const folderSegments = normalizeFolderSegments(request.folder)
        scoped = stripFolderPrefix(scoped, folderSegments)
    }

    if (scoped.length) {
        const tail = scoped[scoped.length - 1]
        const remoteName = normalizeFolderLabel(remote.name)
        const remoteKey = normalizeFolderLabel(remote.id)
        const tailLabel = normalizeFolderLabel(tail)
        if (tailLabel === remoteName || (remoteKey && tailLabel.includes(remoteKey))) scoped = scoped.slice(0, -1)
    }

    return scoped
}

export function ensureTargetFolder(root: Folder, destinationFolderId: string, segments: string[]): Folder {
    let current = resolveDestinationFolder(root, destinationFolderId)
    for (const segment of segments) {
        const existing = current.children.find((child) => isFolder(child) && child.name === segment)
        if (existing && isFolder(existing)) {
            current = existing
            continue
        }

        const next = mkFolder(segment)
        current.children.push(next)
        current = next
    }
    return current
}

export function resolveDestinationFolder(root: Folder, folderId: string): Folder {
    const node = findNode(root, folderId)
    return node && isFolder(node) ? node : root
}

export function joinFolderLabel(base: string, segments: string[]): string {
    return segments.length ? `${base} / ${segments.join(' / ')}` : base
}

function findFolderLabels(root: Folder, folderId: string, trail: string[] = []): string[] {
    if (root.id === folderId) return [...trail, root.name]
    for (const child of root.children) {
        if (!isFolder(child)) continue
        const found = findFolderLabels(child, folderId, [...trail, root.name])
        if (found.length) return found
    }
    return []
}

function normalizeFolderSegments(value: string | undefined): string[] {
    return String(value ?? '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
}

function stripFolderPrefix(value: string[], prefix: string[]): string[] {
    if (!prefix.length) return value
    let index = 0
    while (
        index < value.length &&
        index < prefix.length &&
        normalizeFolderLabel(value[index]) === normalizeFolderLabel(prefix[index])
    ) {
        index += 1
    }
    return value.slice(index)
}

function normalizeFolderLabel(value: string | undefined): string {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '')
}
