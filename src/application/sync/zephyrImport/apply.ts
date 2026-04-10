import type { Folder, RootState, TestCase } from '@core/domain'
import { findNode, findParentFolder, insertChild, isFolder, mapTests, moveNode as moveTreeNode } from '@core/tree'
import { getStoredJsonBeautifyTolerant } from '@shared/uiPreferences'
import type { SyncText } from '../text'
import { getZephyrTestIntegration, setZephyrTestIntegration } from '@providers/zephyr/zephyrModel'
import { buildTargetFolderSegments, ensureTargetFolder, getConflictFolderName, resolveDestinationFolder } from './folders'
import { IMPORT_CONFLICT_LOCAL_ID, IMPORT_CONFLICT_REMOTE_KEY } from './markers'
import { buildLocalMatchIndex, findLocalMatches, materializeImportedTest, upsertLocalMatch } from './materialize'
import type { ZephyrImportApplyResult, ZephyrImportPreview, ZephyrImportPreviewItem, ZephyrImportRequest } from './types'

export function applyZephyrImportPreview(state: RootState, preview: ZephyrImportPreview, text: SyncText): ZephyrImportApplyResult {
    const destinationFolder = resolveDestinationFolder(state.root, preview.destinationFolderId)
    const currentTests = mapTests(state.root)
    const localMatchIndex = buildLocalMatchIndex(currentTests)
    const conflictDraftIndex = buildConflictDraftIndex(currentTests)
    const tolerantJsonBeautify = getStoredJsonBeautifyTolerant()
    const result: ZephyrImportApplyResult = {
        created: 0,
        createdTestIds: [],
        updated: 0,
        updatedTestIds: [],
        skipped: 0,
        drafts: 0,
        unchanged: 0,
    }

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
            upsertConflictDraft(state, destinationFolder, item, preview.request, text, conflictDraftIndex)
            result.drafts += 1
            continue
        }

        const localMatches = findLocalMatches(item.remote, localMatchIndex)
        const existing = localMatches.length === 1 ? localMatches[0] : undefined
        const imported = materializeImportedTest(item.remote, existing, { tolerantJsonBeautify })
        const targetFolder = ensureTargetFolder(state.root, destinationFolder.id, item.targetFolderSegments)

        if (existing) {
            const localNode = findNode(state.root, existing.id)
            if (!localNode || isFolder(localNode)) {
                insertChild(state.root, targetFolder.id, imported)
                upsertLocalMatch(localMatchIndex, imported)
                result.created += 1
                result.createdTestIds.push(imported.id)
                continue
            }

            Object.assign(localNode, imported, { id: existing.id })
            const parent = findParentFolder(state.root, existing.id)
            if (parent && parent.id !== targetFolder.id) moveTreeNode(state.root, existing.id, targetFolder.id)
            upsertLocalMatch(localMatchIndex, localNode)
            result.updated += 1
            result.updatedTestIds.push(localNode.id)
            continue
        }

        insertChild(state.root, targetFolder.id, imported)
        upsertLocalMatch(localMatchIndex, imported)
        result.created += 1
        result.createdTestIds.push(imported.id)
    }

    return result
}

function upsertConflictDraft(
    state: RootState,
    destinationFolder: Folder,
    item: ZephyrImportPreviewItem,
    request: ZephyrImportRequest,
    text: SyncText,
    draftIndex: Map<string, TestCase>
) {
    const local = item.localTestId ? findNode(state.root, item.localTestId) : null
    const localTest = local && !isFolder(local) ? local : undefined
    const imported = materializeImportedTest(item.remote, undefined, {
        tolerantJsonBeautify: getStoredJsonBeautifyTolerant(),
    })
    imported.name = `[Import draft] ${item.remote.name}`
    imported.links = imported.links.filter((link) => link.provider !== 'zephyr')
    setZephyrTestIntegration(imported, {
        ...(getZephyrTestIntegration(imported) ?? {}),
        importState: {
            ...(getZephyrTestIntegration(imported)?.importState ?? {}),
            conflictRemoteKey: item.remoteId,
            ...(localTest ? { conflictLocalId: localTest.id } : {}),
        },
    })

    const baseFolder = ensureTargetFolder(state.root, destinationFolder.id, [getConflictFolderName(text), ...buildTargetFolderSegments(item.remote, request)])
    const draftKey = makeConflictDraftKey(item.remoteId, localTest?.id)
    const existingDraft = draftIndex.get(draftKey)

    if (existingDraft) {
        Object.assign(existingDraft, imported, { id: existingDraft.id })
        const parent = findParentFolder(state.root, existingDraft.id)
        if (parent && parent.id !== baseFolder.id) moveTreeNode(state.root, existingDraft.id, baseFolder.id)
        draftIndex.set(draftKey, existingDraft)
        return
    }

    insertChild(state.root, baseFolder.id, imported)
    draftIndex.set(draftKey, imported)
}

function buildConflictDraftIndex(tests: TestCase[]) {
    const index = new Map<string, TestCase>()
    for (const test of tests) {
        const importState = getZephyrTestIntegration(test)?.importState
        const remoteId = String(importState?.conflictRemoteKey ?? '').trim()
        if (!remoteId) continue
        const localId = String(importState?.conflictLocalId ?? '').trim() || undefined
        index.set(makeConflictDraftKey(remoteId, localId), test)
    }
    return index
}

function makeConflictDraftKey(remoteId: string, localId?: string) {
    return `${String(remoteId ?? '').trim()}\u0000${String(localId ?? '').trim()}`
}
