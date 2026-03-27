import { mdToHtml, looksLikeHtml } from './markdown'
import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from './previewDiff'
import { buildExport } from './export'
import { buildRefCatalog, resolveRefsInText } from './refs'
import { nowISO, type RootState, type TestCase, type TestMeta } from './domain'
import { mapTests } from './tree'
import type { ProviderStep, ProviderTest } from '@providers/types'

export type ZephyrPublishStatus = 'create' | 'update' | 'skip' | 'blocked'
export type ZephyrPublishDiffField =
    | 'name'
    | 'description'
    | 'steps'
    | 'objective'
    | 'preconditions'
    | 'folder'
    | 'labels'

export interface ZephyrPublishDiff {
    field: ZephyrPublishDiffField
    label: string
    local: string
    remote: string
    stepRows?: PreviewStepDiffRow[]
}

export interface ZephyrPublishPreviewItem {
    id: string
    testId: string
    testName: string
    externalId?: string
    projectKey?: string
    folder?: string
    status: ZephyrPublishStatus
    reason: string
    publish: boolean
    diffs: ZephyrPublishDiff[]
    payload: ProviderTest
    attachmentWarnings: string[]
}

export interface ZephyrPublishPreview {
    selectionLabel: string
    generatedAt: string
    items: ZephyrPublishPreviewItem[]
    summary: {
        total: number
        create: number
        update: number
        skip: number
        blocked: number
    }
}

export interface ZephyrPublishLogItem {
    testId: string
    testName: string
    status: 'created' | 'updated' | 'skipped' | 'failed' | 'blocked'
    externalId?: string
    reason?: string
    error?: string
    attachmentWarnings?: string[]
}

export interface ZephyrPublishResult {
    created: number
    updated: number
    skipped: number
    failed: number
    blocked: number
    logItems: ZephyrPublishLogItem[]
}

const PUBLISH_SIGNATURE_KEY = '__zephyrPublish.signature'
const PUBLISH_REMOTE_KEY = '__zephyrPublish.remoteKey'
const PUBLISH_AT_KEY = '__zephyrPublish.publishedAt'

export function buildZephyrPublishPreview(
    state: RootState,
    tests: TestCase[],
    remoteMap: Map<string, ProviderTest | Error>,
    selectionLabel: string
): ZephyrPublishPreview {
    const items = tests.map((test) => buildPreviewItem(state, test, remoteMap))

    return {
        selectionLabel,
        generatedAt: nowISO(),
        items,
        summary: {
            total: items.length,
            create: items.filter((item) => item.status === 'create').length,
            update: items.filter((item) => item.status === 'update').length,
            skip: items.filter((item) => item.status === 'skip').length,
            blocked: items.filter((item) => item.status === 'blocked').length,
        },
    }
}

export function buildZephyrPublishPayload(test: TestCase, state: RootState): ProviderTest {
    const exportPayload = buildExport(test, state)
    const refCatalog = buildRefCatalog(mapTests(state.root), state.sharedSteps)
    const render = (value: string | undefined) => renderZephyrText(value, refCatalog)
    const externalId = resolveZephyrExternalId(test) ?? ''
    const projectKey = resolveProjectKey(test)
    const folder = safeString(test.meta?.params?.folder)
    const objective = render(test.meta?.objective)
    const preconditions = render(test.meta?.preconditions)
    const labels = (test.meta?.tags ?? []).map((item) => String(item).trim()).filter(Boolean)

    return {
        id: externalId,
        name: test.name,
        description: render(exportPayload.description),
        steps: exportPayload.steps.map((step) => ({
            action: render(step.action),
            data: render(step.data),
            expected: render(step.expected),
            text: render(step.action),
        })),
        attachments: exportPayload.attachments,
        updatedAt: nowISO(),
        extras: {
            projectKey,
            folder,
            objective,
            preconditions,
            labels,
        },
    }
}

export function applyPublishSuccess(test: TestCase, externalId: string, payload: ProviderTest) {
    test.links = [
        ...(test.links ?? []).filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId },
    ]

    test.meta = test.meta ?? { tags: [], params: {} }
    test.meta.params = test.meta.params ?? {}
    test.meta.params.key = externalId

    const projectKey = safeString(payload.extras?.projectKey)
    if (projectKey) test.meta.params.projectKey = projectKey

    const folder = safeString(payload.extras?.folder)
    if (folder) test.meta.params.folder = folder

    test.meta.params[PUBLISH_SIGNATURE_KEY] = buildPublishSignature(payload)
    test.meta.params[PUBLISH_REMOTE_KEY] = externalId
    test.meta.params[PUBLISH_AT_KEY] = nowISO()
    test.updatedAt = nowISO()
}

function buildPreviewItem(
    state: RootState,
    test: TestCase,
    remoteMap: Map<string, ProviderTest | Error>
): ZephyrPublishPreviewItem {
    const payload = buildZephyrPublishPayload(test, state)
    const externalId = safeString(payload.id)
    const projectKey = safeString(payload.extras?.projectKey)
    const folder = safeString(payload.extras?.folder)
    const attachmentWarnings = collectAttachmentWarnings(test, payload)

    if (!externalId && !projectKey) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            status: 'blocked',
            reason: 'Missing projectKey for create publish',
            publish: false,
            diffs: [],
            payload,
            attachmentWarnings,
        }
    }

    if (!externalId) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            projectKey,
            folder,
            status: 'create',
            reason: 'Will create a new Zephyr test case',
            publish: true,
            diffs: buildCreateDiffs(payload),
            payload,
            attachmentWarnings,
        }
    }

    const remote = remoteMap.get(externalId)
    if (remote instanceof Error) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'blocked',
            reason: remote.message || 'Failed to load remote test case before publish',
            publish: false,
            diffs: [],
            payload,
            attachmentWarnings,
        }
    }

    if (!remote) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'blocked',
            reason: 'Remote test case is unavailable for dry-run diff',
            publish: false,
            diffs: [],
            payload,
            attachmentWarnings,
        }
    }

    const diffs = diffPayloadAgainstRemote(payload, remote)
    if (diffs.length === 0) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'skip',
            reason: 'Remote test case already matches local content',
            publish: false,
            diffs: [],
            payload,
            attachmentWarnings,
        }
    }

    return {
        id: test.id,
        testId: test.id,
        testName: test.name,
        externalId,
        projectKey,
        folder,
        status: 'update',
        reason: 'Remote test case will be replaced with local content',
        publish: true,
        diffs,
        payload,
        attachmentWarnings,
    }
}

function diffPayloadAgainstRemote(local: ProviderTest, remote: ProviderTest): ZephyrPublishDiff[] {
    const diffs: ZephyrPublishDiff[] = []
    pushDiff(diffs, 'name', 'Name', local.name, remote.name)
    pushDiff(
        diffs,
        'description',
        'Description',
        summarizePreviewText(local.description),
        summarizePreviewText(remote.description)
    )
    pushDiff(
        diffs,
        'steps',
        'Steps',
        summarizePreviewSteps(local.steps),
        summarizePreviewSteps(remote.steps),
        buildPreviewStepDiffRows(local.steps, remote.steps)
    )
    pushDiff(
        diffs,
        'objective',
        'Objective',
        summarizePreviewText(safeString(local.extras?.objective)),
        summarizePreviewText(safeString(remote.extras?.objective))
    )
    pushDiff(
        diffs,
        'preconditions',
        'Preconditions',
        summarizePreviewText(safeString(local.extras?.preconditions)),
        summarizePreviewText(safeString(remote.extras?.preconditions))
    )
    pushDiff(diffs, 'folder', 'Folder', safeString(local.extras?.folder) ?? 'No folder', safeString(remote.extras?.folder) ?? 'No folder')
    pushDiff(diffs, 'labels', 'Labels', summarizeLabels(local.extras?.labels), summarizeLabels(remote.extras?.labels))
    return diffs
}

function buildCreateDiffs(local: ProviderTest): ZephyrPublishDiff[] {
    return [
        { field: 'name', label: 'Name', local: local.name, remote: 'No remote test case' },
        {
            field: 'steps',
            label: 'Steps',
            local: summarizePreviewSteps(local.steps),
            remote: 'No remote test case',
            stepRows: buildPreviewStepDiffRows(local.steps, []),
        },
        {
            field: 'folder',
            label: 'Folder',
            local: safeString(local.extras?.folder) ?? 'No folder',
            remote: 'No remote test case',
        },
    ]
}

function renderZephyrText(value: string | undefined, catalog: ReturnType<typeof buildRefCatalog>): string {
    const raw = String(value ?? '')
    if (!raw.trim()) return ''
    const resolved = resolveRefsInText(raw, catalog)
    return looksLikeHtml(resolved) ? resolved : mdToHtml(resolved)
}

function resolveProjectKey(test: TestCase): string | undefined {
    const explicit = safeString(test.meta?.params?.projectKey)
    if (explicit) return explicit
    const linked = resolveZephyrExternalId(test)
    const match = linked?.match(/^([A-Z][A-Z0-9_]+)-\d+$/)
    return match?.[1]
}

export function resolveZephyrExternalId(test: Pick<TestCase, 'links' | 'meta'>): string | undefined {
    const link = test.links?.find((item) => item.provider === 'zephyr')?.externalId
    const fromLink = safeString(link)
    if (fromLink) return fromLink
    return safeString(test.meta?.params?.key ?? test.meta?.params?.[PUBLISH_REMOTE_KEY])
}

function collectAttachmentWarnings(test: TestCase, payload: ProviderTest): string[] {
    if (!(test.attachments?.length ?? 0)) return []
    return ['Attachments are not uploaded yet; publish logs will keep them listed as skipped.']
}

function buildPublishSignature(payload: ProviderTest): string {
    return JSON.stringify({
        name: payload.name,
        description: payload.description ?? '',
        steps: payload.steps.map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
        })),
        objective: safeString(payload.extras?.objective) ?? '',
        preconditions: safeString(payload.extras?.preconditions) ?? '',
        folder: safeString(payload.extras?.folder) ?? '',
        labels: normalizeLabels(payload.extras?.labels),
    })
}

function summarizeProviderSteps(steps: ProviderStep[]): string {
    if (!steps?.length) return '0 steps'
    const head = steps
        .slice(0, 2)
        .map((step) => summarizeText(step.action || step.text || 'Empty step'))
        .filter(Boolean)
    return `${steps.length} steps${head.length ? ` - ${head.join(' | ')}` : ''}`
}

function summarizeLabels(value: unknown): string {
    const labels = normalizeLabels(value)
    return labels.length ? labels.join(', ') : 'No labels'
}

function normalizeLabels(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean).sort((left, right) => left.localeCompare(right))
        : []
}

function summarizeText(value: string | undefined, limit = 120): string {
    const text = String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return 'Empty'
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function pushDiff(
    diffs: ZephyrPublishDiff[],
    field: ZephyrPublishDiffField,
    label: string,
    local: string,
    remote: string,
    stepRows?: PreviewStepDiffRow[]
) {
    const hasStepChanges = !!stepRows?.some((row) => row.changed)
    if (local === remote && !hasStepChanges) return
    diffs.push({ field, label, local, remote, ...(stepRows?.length ? { stepRows } : {}) })
}

function safeString(value: unknown): string | undefined {
    const next = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    return next || undefined
}
