import { nowISO, type Folder, type RootState, type TestCase, type TestMeta } from '@core/domain'
import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from '@core/previewDiff'
import { findParentFolder, mapTests } from '@core/tree'
import type { ProviderTest } from '@providers/types'
import { translate } from '@shared/i18n'
import {
    buildTargetFolderSegments,
    describeFolderPath,
    joinFolderLabel,
    resolveDestinationFolder,
} from './folders'
import { buildImportManagedSignature, getImportMetaKeys, getImportSignature, getManagedMetaKeys, isImportMarkerKey } from './markers'
import { findLocalMatches, materializeImportedTest } from './materialize'
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
    query = buildZephyrImportQuery(request)
): ZephyrImportPreview {
    const destinationFolder = resolveDestinationFolder(state.root, request.destinationFolderId)
    const allTests = mapTests(state.root)
    const items = remotes
        .slice()
        .sort((left, right) => compareImportTargets(left, right))
        .map((remote) => buildPreviewItem(state.root, allTests, destinationFolder, request, remote))

    return {
        request,
        query,
        destinationFolderId: destinationFolder.id,
        destinationFolderLabel: describeFolderPath(state.root, destinationFolder.id),
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
    allTests: TestCase[],
    destinationFolder: Folder,
    request: ZephyrImportRequest,
    remote: ProviderTest
): ZephyrImportPreviewItem {
    const localMatches = findLocalMatches(remote, allTests)
    const existing = localMatches.length === 1 ? localMatches[0] : undefined
    const imported = materializeImportedTest(remote, existing)
    const targetFolderSegments = buildTargetFolderSegments(remote, request)
    const targetFolderLabel = joinFolderLabel(describeFolderPath(root, destinationFolder.id), targetFolderSegments)
    const localFolder = existing ? describeFolderPath(root, findParentFolder(root, existing.id)?.id ?? root.id) : undefined
    const diffs = existing
        ? diffImportedFields(root, existing, imported, targetFolderLabel)
        : diffNewImportedFields(imported, targetFolderLabel)
    const evaluation = evaluateImportState(existing, imported, localMatches.length)

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
    localMatchCount: number
): { status: ZephyrImportStatus; reason: string; strategy: ZephyrImportStrategy; replaceDisabled?: boolean } {
    const t = translate
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

function diffImportedFields(root: Folder, local: TestCase, remote: TestCase, targetFolderLabel: string): ZephyrImportDiff[] {
    const t = translate
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
    pushDiff(diffs, 'meta', t('import.diff.meta'), summarizeMeta(local.meta), summarizeMeta(remote.meta))
    pushDiff(diffs, 'attachments', t('import.diff.attachments'), summarizeAttachments(local), summarizeAttachments(remote))

    const localFolder = describeFolderPath(root, findParentFolder(root, local.id)?.id ?? root.id)
    pushDiff(diffs, 'folder', t('import.diff.folder'), localFolder, targetFolderLabel)
    return diffs
}

function diffNewImportedFields(remote: TestCase, targetFolderLabel: string): ZephyrImportDiff[] {
    const t = translate
    return [
        { field: 'name', label: t('import.diff.name'), local: t('import.diff.newLocal'), remote: remote.name },
        {
            field: 'steps',
            label: t('import.diff.steps'),
            local: t('import.diff.noLocal'),
            remote: summarizePreviewSteps(remote.steps),
            stepRows: buildPreviewStepDiffRows([], remote.steps),
        },
        { field: 'meta', label: t('import.diff.meta'), local: t('import.diff.noLocal'), remote: summarizeMeta(remote.meta) },
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

function summarizeMeta(meta: TestMeta | undefined): string {
    const t = translate
    const paramsCount = Object.keys(meta?.params ?? {}).filter((key) => !isImportMarkerKey(key)).length
    const bits = [
        meta?.objective ? t('import.summary.objective') : '',
        meta?.preconditions ? t('import.summary.preconditions') : '',
        paramsCount ? t('import.summary.params', { count: paramsCount }) : '',
    ].filter(Boolean)
    return bits.length ? bits.join(', ') : t('import.summary.noMeta')
}

function summarizeAttachments(test: Pick<TestCase, 'attachments' | 'steps'>): string {
    const t = translate
    const total = (test.attachments?.length ?? 0) + (test.steps ?? []).reduce((sum, step) => sum + (step.attachments?.length ?? 0), 0)
    return total ? t('import.summary.attachments', { count: total }) : t('import.summary.noAttachments')
}

export type { ZephyrImportApplyResult }
