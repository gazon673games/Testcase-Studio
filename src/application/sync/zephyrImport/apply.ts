import type { Folder, RootState } from '@core/domain'
import { findNode, findParentFolder, insertChild, isFolder, mapTests, moveNode as moveTreeNode } from '@core/tree'
import type { SyncText } from '../text'
import { buildTargetFolderSegments, ensureTargetFolder, getConflictFolderName, resolveDestinationFolder } from './folders'
import { IMPORT_CONFLICT_LOCAL_ID, IMPORT_CONFLICT_REMOTE_KEY } from './markers'
import { findLocalMatches, materializeImportedTest } from './materialize'
import type { ZephyrImportApplyResult, ZephyrImportPreview, ZephyrImportPreviewItem, ZephyrImportRequest } from './types'

export function applyZephyrImportPreview(state: RootState, preview: ZephyrImportPreview, text: SyncText): ZephyrImportApplyResult {
    const destinationFolder = resolveDestinationFolder(state.root, preview.destinationFolderId)
    const result: ZephyrImportApplyResult = { created: 0, updated: 0, skipped: 0, drafts: 0, unchanged: 0 }

    for (const item of preview.items) {
        if (item.status === 'unchanged' && item.strategy === 'skip') {
            result.unchanged += 1
            continue
        }

        if (item.strategy === 'skip') {
            result.skipped += 1
            continue
        }

        if (item.strategy === 'replace' && item.replaceDisabled) {
            result.skipped += 1
            continue
        }

        if (item.strategy === 'merge-locally-later') {
            upsertConflictDraft(state, destinationFolder, item, preview.request, text)
            result.drafts += 1
            continue
        }

        const currentAllTests = mapTests(state.root)
        const localMatches = findLocalMatches(item.remote, currentAllTests)
        const existing = localMatches.length === 1 ? localMatches[0] : undefined
        const imported = materializeImportedTest(item.remote, existing)
        const targetFolder = ensureTargetFolder(state.root, destinationFolder.id, item.targetFolderSegments)

        if (existing) {
            const localNode = findNode(state.root, existing.id)
            if (!localNode || isFolder(localNode)) {
                insertChild(state.root, targetFolder.id, imported)
                result.created += 1
                continue
            }

            Object.assign(localNode, imported, { id: existing.id })
            const parent = findParentFolder(state.root, existing.id)
            if (parent && parent.id !== targetFolder.id) moveTreeNode(state.root, existing.id, targetFolder.id)
            result.updated += 1
            continue
        }

        insertChild(state.root, targetFolder.id, imported)
        result.created += 1
    }

    return result
}

function upsertConflictDraft(
    state: RootState,
    destinationFolder: Folder,
    item: ZephyrImportPreviewItem,
    request: ZephyrImportRequest,
    text: SyncText
) {
    const local = item.localTestId ? findNode(state.root, item.localTestId) : null
    const localTest = local && !isFolder(local) ? local : undefined
    const imported = materializeImportedTest(item.remote)
    imported.name = `[Import draft] ${item.remote.name}`
    imported.links = imported.links.filter((link) => link.provider !== 'zephyr')
    imported.meta = imported.meta ?? { tags: [], params: {} }
    imported.meta.params = imported.meta.params ?? {}
    imported.meta.params[IMPORT_CONFLICT_REMOTE_KEY] = item.remoteId
    if (localTest) imported.meta.params[IMPORT_CONFLICT_LOCAL_ID] = localTest.id

    const baseFolder = ensureTargetFolder(state.root, destinationFolder.id, [getConflictFolderName(text), ...buildTargetFolderSegments(item.remote, request)])
    const existingDraft = mapTests(state.root).find((test) => {
        const params = test.meta?.params ?? {}
        if (params[IMPORT_CONFLICT_REMOTE_KEY] !== item.remoteId) return false
        if (localTest) return params[IMPORT_CONFLICT_LOCAL_ID] === localTest.id
        return !params[IMPORT_CONFLICT_LOCAL_ID]
    })

    if (existingDraft) {
        Object.assign(existingDraft, imported, { id: existingDraft.id })
        const parent = findParentFolder(state.root, existingDraft.id)
        if (parent && parent.id !== baseFolder.id) moveTreeNode(state.root, existingDraft.id, baseFolder.id)
        return
    }

    insertChild(state.root, baseFolder.id, imported)
}
