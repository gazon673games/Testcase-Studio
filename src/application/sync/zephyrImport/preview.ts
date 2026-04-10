import { nowISO, type Folder, type RootState, type TestCase, type TestMeta } from '@core/domain'
import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from '@core/previewDiff'
import { findParentFolder, mapTests } from '@core/tree'
import type { ProviderTest } from '@providers/types'
import { getZephyrTestIntegration } from '@providers/zephyr/zephyrModel'
import { getStoredJsonBeautifyTolerant } from '@shared/uiPreferences'
import type { SyncText } from '../text'
import {
    buildTargetFolderSegments,
    describeFolderPath,
    joinFolderLabel,
    resolveDestinationFolder,
} from './folders'
import { buildImportManagedSignature, getImportMetaKeys, getImportSignature, getManagedMetaKeys, isImportMarkerKey } from './markers'
import { buildLocalMatchIndex, findLocalMatches, type LocalMatchIndex, materializeImportedTest } from './materialize'
import { compareImportTargets } from './shared'
import type {
    ZephyrImportApplyResult,
    ZephyrImportDiff,
    ZephyrImportDiffField,
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportRequest,
    ZephyrImportStatus,
    ZephyrImportStrategy,
} from './types'
import { buildZephyrImportQuery } from './query'

export function buildZephyrImportPreview(
    state: RootState,
    request: ZephyrImportRequest,
    remotes: ProviderTest[],
    text: SyncText,
    query = buildZephyrImportQuery(request)
): ZephyrImportPreview {
    const destinationFolder = resolveDestinationFolder(state.root, request.destinationFolderId)
    const localMatchIndex = buildLocalMatchIndex(mapTests(state.root))
    const items = remotes
        .slice()
        .sort((left, right) => compareImportTargets(left, right))
        .map((remote) => buildPreviewItem(state.root, localMatchIndex, destinationFolder, request, remote, text))

    return {
        request,
        query,
        destinationFolderId: destinationFolder.id,
        destinationFolderLabel: describeFolderPath(state.root, destinationFolder.id, text.rootLabel),
        generatedAt: nowISO(),
        items,
        summary: {
            total: items.length,
            created: items.filter((item) => item.status === 'new').length,
            unchanged: items.filter((item) => item.status === 'unchanged').length,
            updates: items.filter((item) => item.status === 'update').length,
            conflicts: items.filter((item) => item.status === 'conflict').length,
        },
    }
}

function buildPreviewItem(
    root: Folder,
    localMatchIndex: LocalMatchIndex,
    destinationFolder: Folder,
    request: ZephyrImportRequest,
    remote: ProviderTest,
    text: SyncText
): ZephyrImportPreviewItem {
    const localMatches = findLocalMatches(remote, localMatchIndex)
    const existing = localMatches.length === 1 ? localMatches[0] : undefined
    const imported = materializeImportedTest(remote, existing, {
        tolerantJsonBeautify: getStoredJsonBeautifyTolerant(),
    })
    const targetFolderSegments = buildTargetFolderSegments(remote, request)
    const targetFolderLabel = joinFolderLabel(describeFolderPath(root, destinationFolder.id, text.rootLabel), targetFolderSegments)
    const localFolder = existing ? describeFolderPath(root, findParentFolder(root, existing.id)?.id ?? root.id, text.rootLabel) : undefined
    const diffs = existing
        ? diffImportedFields(root, existing, imported, targetFolderLabel, text)
        : diffNewImportedFields(imported, targetFolderLabel, text)
    const evaluation = evaluateImportState(existing, imported, localMatches.length, text)

    return {
        id: remote.id,
        remote,
        remoteId: remote.id,
        remoteName: remote.name,
        remoteFolder: remote.extras?.folder ? String(remote.extras.folder) : undefined,
        localTestId: existing?.id,
        localName: existing?.name,
        localFolder,
        localMatchIds: localMatches.map((test) => test.id),
        status: evaluation.status,
        reason: evaluation.reason,
        strategy: evaluation.strategy,
        replaceDisabled: evaluation.replaceDisabled,
        targetFolderSegments,
        targetFolderLabel,
        diffs,
    }
}

function evaluateImportState(
    existing: TestCase | undefined,
    imported: TestCase,
    localMatchCount: number,
    text: SyncText
): { status: ZephyrImportStatus; reason: string; strategy: ZephyrImportStrategy; replaceDisabled?: boolean } {
    const t = text.t
    if (localMatchCount > 1) {
        return {
            status: 'conflict',
            reason: t('import.reason.multipleMatches'),
            strategy: 'skip',
            replaceDisabled: true,
        }
    }

    if (!existing) {
        return { status: 'new', reason: t('import.reason.newLocal'), strategy: 'replace' }
    }

    const storedSignature = getImportSignature(existing)
    const currentManagedKeys = getImportMetaKeys(existing) ?? getManagedMetaKeys(imported)
    const localSignature = buildImportManagedSignature(existing, currentManagedKeys)
    const remoteSignature = buildImportManagedSignature(imported, getManagedMetaKeys(imported))

    if (localSignature === remoteSignature) {
        return { status: 'unchanged', reason: t('import.reason.matchesRemote'), strategy: 'skip' }
    }

    if (storedSignature) {
        if (localSignature === storedSignature) {
            return { status: 'update', reason: t('import.reason.remoteChanged'), strategy: 'replace' }
        }
        if (remoteSignature === storedSignature) {
            return { status: 'conflict', reason: t('import.reason.onlyLocalChanged'), strategy: 'skip' }
        }
        return { status: 'conflict', reason: t('import.reason.bothChanged'), strategy: 'skip' }
    }

    return {
        status: 'conflict',
        reason: t('import.reason.noBaseline'),
        strategy: 'skip',
    }
}

function diffImportedFields(root: Folder, local: TestCase, remote: TestCase, targetFolderLabel: string, text: SyncText): ZephyrImportDiff[] {
    const t = text.t
    const diffs: ZephyrImportDiff[] = []
    pushDiff(diffs, 'name', t('import.diff.name'), local.name, remote.name)
    pushDiff(
        diffs,
        'description',
        t('import.diff.description'),
        summarizePreviewText(local.description),
        summarizePreviewText(remote.description)
    )
    pushDiff(
        diffs,
        'steps',
        t('import.diff.steps'),
        summarizePreviewSteps(local.steps),
        summarizePreviewSteps(remote.steps),
        buildPreviewStepDiffRows(local.steps, remote.steps)
    )
    pushDiff(diffs, 'meta', t('import.diff.meta'), summarizeMeta(local, text), summarizeMeta(remote, text))
    pushDiff(diffs, 'attachments', t('import.diff.attachments'), summarizeAttachments(local, text), summarizeAttachments(remote, text))

    const localFolder = describeFolderPath(root, findParentFolder(root, local.id)?.id ?? root.id, text.rootLabel)
    pushDiff(diffs, 'folder', t('import.diff.folder'), localFolder, targetFolderLabel)
    return diffs
}

function diffNewImportedFields(remote: TestCase, targetFolderLabel: string, text: SyncText): ZephyrImportDiff[] {
    const t = text.t
    return [
        { field: 'name', label: t('import.diff.name'), local: t('import.diff.newLocal'), remote: remote.name },
        {
            field: 'steps',
            label: t('import.diff.steps'),
            local: t('import.diff.noLocal'),
            remote: summarizePreviewSteps(remote.steps),
            stepRows: buildPreviewStepDiffRows([], remote.steps),
        },
        { field: 'meta', label: t('import.diff.meta'), local: t('import.diff.noLocal'), remote: summarizeMeta(remote, text) },
        { field: 'folder', label: t('import.diff.folder'), local: t('import.diff.willCreate'), remote: targetFolderLabel },
    ]
}

function pushDiff(
    diffs: ZephyrImportDiff[],
    field: ZephyrImportDiffField,
    label: string,
    local: string,
    remote: string,
    stepRows?: PreviewStepDiffRow[]
) {
    const hasStepChanges = !!stepRows?.some((row) => row.changed)
    if (local === remote && !hasStepChanges) return
    diffs.push({ field, label, local, remote, ...(stepRows?.length ? { stepRows } : {}) })
}

function summarizeMeta(test: TestCase, text: SyncText): string {
    const t = text.t
    const details = test.details
    const paramsCount = Object.keys(details?.attributes ?? {}).filter((key) => !isImportMarkerKey(key)).length
    const zephyr = getZephyrTestIntegration(test)
    const bits = [
        details?.objective ? t('import.summary.objective') : '',
        details?.preconditions ? t('import.summary.preconditions') : '',
        paramsCount ? t('import.summary.params', { count: paramsCount }) : '',
    ].filter(Boolean)
    return bits.length ? bits.join(', ') : t('import.summary.noMeta')
}

function summarizeAttachments(test: Pick<TestCase, 'attachments' | 'steps'>, text: SyncText): string {
    const t = text.t
    const total = (test.attachments?.length ?? 0) + (test.steps ?? []).reduce((sum, step) => sum + (step.attachments?.length ?? 0), 0)
    return total ? t('import.summary.attachments', { count: total }) : t('import.summary.noAttachments')
}

export type { ZephyrImportApplyResult }
