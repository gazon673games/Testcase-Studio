import {
    mkFolder,
    mkTest,
    normalizeTestCase,
    nowISO,
    type Folder,
    type RootState,
    type TestCase,
    type TestCaseLink,
    type TestMeta,
} from './domain'
import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from './previewDiff'
import { findNode, findParentFolder, insertChild, isFolder, mapTests, moveNode as moveTreeNode } from './tree'
import { fromProviderPayload } from '@providers/mappers'
import type { ProviderTest } from '@providers/types'
import { translate } from '../ui/preferences'

export type ZephyrImportMode = 'project' | 'folder' | 'keys'
export type ZephyrImportStrategy = 'replace' | 'skip' | 'merge-locally-later'
export type ZephyrImportStatus = 'new' | 'unchanged' | 'update' | 'conflict'
export type ZephyrImportDiffField = 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'folder'

export interface ZephyrImportRequest {
    mode: ZephyrImportMode
    destinationFolderId: string
    projectKey?: string
    folder?: string
    refs?: string[]
    rawQuery?: string
    maxResults?: number
    mirrorRemoteFolders?: boolean
}

export interface ZephyrImportDiff {
    field: ZephyrImportDiffField
    label: string
    local: string
    remote: string
    stepRows?: PreviewStepDiffRow[]
}

export interface ZephyrImportPreviewItem {
    id: string
    remote: ProviderTest
    remoteId: string
    remoteName: string
    remoteFolder?: string
    localTestId?: string
    localName?: string
    localFolder?: string
    localMatchIds: string[]
    status: ZephyrImportStatus
    reason: string
    strategy: ZephyrImportStrategy
    replaceDisabled?: boolean
    targetFolderSegments: string[]
    targetFolderLabel: string
    diffs: ZephyrImportDiff[]
}

export interface ZephyrImportPreview {
    request: ZephyrImportRequest
    query: string
    destinationFolderId: string
    destinationFolderLabel: string
    generatedAt: string
    items: ZephyrImportPreviewItem[]
    summary: {
        total: number
        created: number
        unchanged: number
        updates: number
        conflicts: number
    }
}

export interface ZephyrImportApplyResult {
    created: number
    updated: number
    skipped: number
    drafts: number
    unchanged: number
}

const IMPORT_SIGNATURE_KEY = '__zephyrImport.signature'
const IMPORT_META_KEYS_KEY = '__zephyrImport.metaKeys'
const IMPORT_REMOTE_UPDATED_AT_KEY = '__zephyrImport.remoteUpdatedAt'
const IMPORT_IMPORTED_AT_KEY = '__zephyrImport.importedAt'
const IMPORT_REMOTE_KEY_KEY = '__zephyrImport.remoteKey'
const IMPORT_CONFLICT_REMOTE_KEY = '__zephyrImport.conflictRemoteKey'
const IMPORT_CONFLICT_LOCAL_ID = '__zephyrImport.conflictLocalId'
function getConflictFolderName() {
    return translate('import.conflictFolder')
}

export function buildZephyrImportQuery(request: ZephyrImportRequest): string {
    const override = String(request.rawQuery ?? '').trim()
    if (override) return override

    if (request.mode === 'project') {
        const projectKey = String(request.projectKey ?? '').trim()
        return projectKey ? `projectKey = "${escapeQueryValue(projectKey)}"` : ''
    }

    if (request.mode === 'folder') {
        const clauses: string[] = []
        const projectKey = String(request.projectKey ?? '').trim()
        const folder = String(request.folder ?? '').trim()
        if (projectKey) clauses.push(`projectKey = "${escapeQueryValue(projectKey)}"`)
        if (folder) clauses.push(`folder = "${escapeQueryValue(folder)}"`)
        return clauses.join(' AND ')
    }

    const refs = dedupeRefs(request.refs ?? [])
    return refs.length ? `key IN (${refs.map((ref) => `"${escapeQueryValue(ref)}"`).join(', ')})` : ''
}

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

export function applyZephyrImportPreview(state: RootState, preview: ZephyrImportPreview): ZephyrImportApplyResult {
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
            upsertConflictDraft(state, destinationFolder, item, preview.request)
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

export function describeFolderPath(root: Folder, folderId: string): string {
    const labels = findFolderLabels(root, folderId)
    return labels.length ? labels.join(' / ') : translate('defaults.root')
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
        ? diffImportedFields(root, existing, imported, targetFolderLabel, targetFolderSegments)
        : diffNewImportedFields(imported, targetFolderLabel)
    const evaluation = evaluateImportState(existing, imported, localMatches.length)

    return {
        id: remote.id,
        remote,
        remoteId: remote.id,
        remoteName: remote.name,
        remoteFolder: remoteFolderValue(remote),
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

function materializeImportedTest(remote: ProviderTest, existing?: TestCase): TestCase {
    const patch = fromProviderPayload(remote, existing?.steps ?? [])
    const base = existing ? normalizeTestCase(existing) : mkTest(patch.name, patch.description)
    const previousImportedKeys = getImportMetaKeys(existing) ?? []
    const nextImportedKeys = getManagedMetaKeys({ ...base, meta: patch.meta } as TestCase)

    const next: TestCase = normalizeTestCase({
        ...base,
        id: existing?.id ?? base.id,
        name: patch.name,
        description: patch.description,
        steps: patch.steps,
        attachments: patch.attachments,
        links: upsertZephyrLink(existing?.links ?? base.links, remote.id),
        updatedAt: patch.updatedAt ?? nowISO(),
        meta: buildImportedMeta(existing?.meta, patch.meta, previousImportedKeys, nextImportedKeys, remote),
        exportCfg: existing?.exportCfg ?? base.exportCfg,
    })

    const signature = buildImportManagedSignature(next, nextImportedKeys)
    applyImportMarkers(next.meta, {
        signature,
        metaKeys: nextImportedKeys,
        remoteKey: remote.id,
        remoteUpdatedAt: remote.updatedAt,
    })

    return normalizeTestCase(next)
}

function buildImportedMeta(
    existing: TestMeta | undefined,
    incoming: TestMeta | undefined,
    previousImportedKeys: string[],
    nextImportedKeys: string[],
    remote: ProviderTest
): TestMeta {
    const existingParams = existing?.params ?? {}
    const incomingParams = incoming?.params ?? {}
    const preserved: Record<string, string> = {}

    for (const [key, value] of Object.entries(existingParams)) {
        if (isImportMarkerKey(key)) continue
        if (previousImportedKeys.includes(key)) continue
        if (nextImportedKeys.includes(key)) continue
        preserved[key] = value
    }

    return {
        ...(existing ?? { tags: [] }),
        tags: existing?.tags ?? [],
        objective: incoming?.objective,
        preconditions: incoming?.preconditions,
        params: {
            ...preserved,
            ...incomingParams,
            ...(remote.updatedAt ? { updatedOn: String(remote.updatedAt) } : {}),
        },
    }
}

function applyImportMarkers(
    meta: TestMeta | undefined,
    payload: { signature: string; metaKeys: string[]; remoteKey: string; remoteUpdatedAt?: string }
) {
    if (!meta) return
    meta.params = meta.params ?? {}
    meta.params[IMPORT_SIGNATURE_KEY] = payload.signature
    meta.params[IMPORT_META_KEYS_KEY] = JSON.stringify(payload.metaKeys)
    meta.params[IMPORT_REMOTE_KEY_KEY] = payload.remoteKey
    meta.params[IMPORT_IMPORTED_AT_KEY] = nowISO()
    if (payload.remoteUpdatedAt) meta.params[IMPORT_REMOTE_UPDATED_AT_KEY] = payload.remoteUpdatedAt
    else delete meta.params[IMPORT_REMOTE_UPDATED_AT_KEY]
}

export function buildImportManagedSignature(test: TestCase, metaKeys: string[]): string {
    return stableJson({
        name: test.name ?? '',
        description: test.description ?? '',
        steps: (test.steps ?? []).map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
            text: step.text ?? '',
            providerStepId: step.raw?.providerStepId ?? '',
            usesShared: step.usesShared ?? '',
            attachments: collectAttachmentSignature(step.attachments ?? []),
            parts: {
                action: collectPartSignature(step.internal?.parts?.action),
                data: collectPartSignature(step.internal?.parts?.data),
                expected: collectPartSignature(step.internal?.parts?.expected),
            },
        })),
        attachments: (test.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            pathOrDataUrl: attachment.pathOrDataUrl,
        })),
        meta: {
            objective: test.meta?.objective ?? '',
            preconditions: test.meta?.preconditions ?? '',
            params: Object.fromEntries(metaKeys.map((key) => [key, test.meta?.params?.[key] ?? ''])),
        },
    })
}

function getManagedMetaKeys(test: Pick<TestCase, 'meta'> | undefined): string[] {
    return Object.keys(test?.meta?.params ?? {})
        .filter((key) => !isImportMarkerKey(key))
        .sort((left, right) => left.localeCompare(right))
}

function getImportSignature(test: Pick<TestCase, 'meta'> | undefined): string | undefined {
    return safeString(test?.meta?.params?.[IMPORT_SIGNATURE_KEY])
}

function getImportMetaKeys(test: Pick<TestCase, 'meta'> | undefined): string[] | undefined {
    const raw = safeString(test?.meta?.params?.[IMPORT_META_KEYS_KEY])
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map((value) => String(value)).sort((left, right) => left.localeCompare(right)) : undefined
    } catch {
        return undefined
    }
}

function upsertZephyrLink(existing: TestCaseLink[], remoteId: string): TestCaseLink[] {
    return [
        ...existing.filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId: remoteId },
    ]
}

function findLocalMatches(remote: ProviderTest, tests: TestCase[]): TestCase[] {
    const remoteKey = normalizeZephyrRef(remote.id)
    const remoteDigits = extractTrailingDigits(remoteKey)
    const out: TestCase[] = []

    for (const test of tests) {
        const zephyrLink = test.links.find((link) => link.provider === 'zephyr')
        const linkValue = normalizeZephyrRef(zephyrLink?.externalId)
        const linkDigits = extractTrailingDigits(linkValue)
        const metaKey = normalizeZephyrRef(test.meta?.params?.key)
        const metaDigits = extractTrailingDigits(test.meta?.params?.keyNumber ?? metaKey)
        const importKey = normalizeZephyrRef(test.meta?.params?.[IMPORT_REMOTE_KEY_KEY])

        if (
            (linkValue && linkValue === remoteKey) ||
            (metaKey && metaKey === remoteKey) ||
            (importKey && importKey === remoteKey) ||
            (remoteDigits && ((linkDigits && linkDigits === remoteDigits) || (metaDigits && metaDigits === remoteDigits)))
        ) {
            out.push(test)
        }
    }

    return dedupeTests(out)
}

function diffImportedFields(
    root: Folder,
    local: TestCase,
    remote: TestCase,
    targetFolderLabel: string,
    _targetFolderSegments: string[]
): ZephyrImportDiff[] {
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

function summarizeSteps(test: Pick<TestCase, 'steps'>): string {
    const steps = test.steps ?? []
    if (!steps.length) return '0 steps'
    const head = steps
        .slice(0, 2)
        .map((step) => summarizeText(step.action || step.text || 'Empty step'))
        .filter(Boolean)
    return `${steps.length} steps${head.length ? ` — ${head.join(' | ')}` : ''}`
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

function collectPartSignature(parts: Array<{ id?: string; text?: string; export?: boolean }> | undefined) {
    return (parts ?? []).map((part) => ({
        id: String(part.id ?? ''),
        text: String(part.text ?? ''),
        export: part.export !== false,
    }))
}

function collectAttachmentSignature(attachments: Array<{ name?: string; pathOrDataUrl?: string }> | undefined) {
    return (attachments ?? []).map((attachment) => ({
        name: String(attachment.name ?? ''),
        pathOrDataUrl: String(attachment.pathOrDataUrl ?? ''),
    }))
}

function summarizeText(value: string | undefined, limit = 120): string {
    const t = translate
    const text = String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return t('import.summary.empty')
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function buildTargetFolderSegments(remote: ProviderTest, request: ZephyrImportRequest): string[] {
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

function upsertConflictDraft(
    state: RootState,
    destinationFolder: Folder,
    item: ZephyrImportPreviewItem,
    request: ZephyrImportRequest
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

    const baseFolder = ensureTargetFolder(state.root, destinationFolder.id, [getConflictFolderName(), ...buildTargetFolderSegments(item.remote, request)])
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

function ensureTargetFolder(root: Folder, destinationFolderId: string, segments: string[]): Folder {
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

function resolveDestinationFolder(root: Folder, folderId: string): Folder {
    const node = findNode(root, folderId)
    return node && isFolder(node) ? node : root
}

function compareImportTargets(left: ProviderTest, right: ProviderTest): number {
    const leftFolder = remoteFolderValue(left)
    const rightFolder = remoteFolderValue(right)
    return `${leftFolder}\u0000${left.name}`.localeCompare(`${rightFolder}\u0000${right.name}`)
}

function remoteFolderValue(remote: ProviderTest): string {
    return safeString(remote.extras?.folder) ?? ''
}

function joinFolderLabel(base: string, segments: string[]): string {
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

function normalizeZephyrRef(value: unknown): string {
    return String(value ?? '').trim().toUpperCase()
}

function dedupeRefs(values: string[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const value of values) {
        const normalized = normalizeZephyrRef(value)
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        out.push(normalized)
    }
    return out
}

function dedupeTests(values: TestCase[]): TestCase[] {
    const out: TestCase[] = []
    const seen = new Set<string>()
    for (const value of values) {
        if (seen.has(value.id)) continue
        seen.add(value.id)
        out.push(value)
    }
    return out
}

function extractTrailingDigits(value: unknown): string {
    const match = String(value ?? '').match(/(\d+)\s*$/)
    return match?.[1] ?? ''
}

function isImportMarkerKey(key: string): boolean {
    return key.startsWith('__zephyrImport.')
}

function escapeQueryValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function safeString(value: unknown): string | undefined {
    const next = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    return next || undefined
}

function stableJson(value: unknown): string {
    return JSON.stringify(value)
}
