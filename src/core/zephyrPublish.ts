import { mdToHtml, looksLikeHtml } from './markdown'
import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from './previewDiff'
import { buildExport } from './export'
import { buildRefCatalog, renderRefsInText } from './refs'
import { nowISO, type Attachment, type RootState, type TestCase, type TestMeta } from './domain'
import { mapTests } from './tree'
import type { ProviderStep, ProviderTest } from '@providers/types'
import { translate } from '../ui/preferences'

export type ZephyrPublishStatus = 'create' | 'update' | 'skip' | 'blocked'
export type ZephyrPublishDiffField =
    | 'name'
    | 'description'
    | 'steps'
    | 'objective'
    | 'preconditions'
    | 'attachments'
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
    attachmentsToUpload: Attachment[]
    attachmentIdsToDelete: string[]
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
            attachments: (step.attachments ?? []).map(copyAttachment),
        })),
        attachments: (exportPayload.attachments ?? []).map(copyAttachment),
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
    const localAttachments = collectProviderAttachments(payload)
    const t = translate

    if (!externalId && !projectKey) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            status: 'blocked',
            reason: t('publish.reason.missingProjectKey'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, []),
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
            reason: t('publish.reason.create'),
            publish: true,
            diffs: buildCreateDiffs(payload),
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, []),
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
            reason: remote.message || t('publish.reason.remoteLoadFailed'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, []),
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
            reason: t('publish.reason.remoteUnavailable'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, []),
        }
    }

    const remoteAttachments = collectProviderAttachments(remote)
    const attachmentPlan = buildAttachmentPlan(localAttachments, remoteAttachments)
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
            reason: t('publish.reason.skip'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: attachmentPlan.uploads,
            attachmentIdsToDelete: attachmentPlan.deleteIds,
            attachmentWarnings: collectAttachmentWarnings(localAttachments, remoteAttachments),
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
        reason: t('publish.reason.update'),
        publish: true,
        diffs,
        payload,
        attachmentsToUpload: attachmentPlan.uploads,
        attachmentIdsToDelete: attachmentPlan.deleteIds,
        attachmentWarnings: collectAttachmentWarnings(localAttachments, remoteAttachments),
    }
}

function diffPayloadAgainstRemote(local: ProviderTest, remote: ProviderTest): ZephyrPublishDiff[] {
    const t = translate
    const diffs: ZephyrPublishDiff[] = []
    pushDiff(diffs, 'name', t('publish.diff.name'), local.name, remote.name)
    pushDiff(
        diffs,
        'description',
        t('publish.diff.description'),
        summarizePreviewText(local.description),
        summarizePreviewText(remote.description)
    )
    pushDiff(
        diffs,
        'steps',
        t('publish.diff.steps'),
        summarizePreviewSteps(local.steps),
        summarizePreviewSteps(remote.steps),
        buildPreviewStepDiffRows(local.steps, remote.steps)
    )
    pushDiff(
        diffs,
        'objective',
        t('publish.diff.objective'),
        summarizePreviewText(safeString(local.extras?.objective)),
        summarizePreviewText(safeString(remote.extras?.objective))
    )
    pushDiff(
        diffs,
        'preconditions',
        t('publish.diff.preconditions'),
        summarizePreviewText(safeString(local.extras?.preconditions)),
        summarizePreviewText(safeString(remote.extras?.preconditions))
    )
    pushDiff(diffs, 'attachments', t('publish.diff.attachments'), summarizeAttachments(local), summarizeAttachments(remote))
    pushDiff(
        diffs,
        'folder',
        t('publish.diff.folder'),
        safeString(local.extras?.folder) ?? t('publish.diff.noFolder'),
        safeString(remote.extras?.folder) ?? t('publish.diff.noFolder')
    )
    pushDiff(diffs, 'labels', t('publish.diff.labels'), summarizeLabels(local.extras?.labels), summarizeLabels(remote.extras?.labels))
    return diffs
}

function buildCreateDiffs(local: ProviderTest): ZephyrPublishDiff[] {
    const t = translate
    return [
        { field: 'name', label: t('publish.diff.name'), local: local.name, remote: t('publish.diff.noRemote') },
        {
            field: 'steps',
            label: t('publish.diff.steps'),
            local: summarizePreviewSteps(local.steps),
            remote: t('publish.diff.noRemote'),
            stepRows: buildPreviewStepDiffRows(local.steps, []),
        },
        {
            field: 'folder',
            label: t('publish.diff.folder'),
            local: safeString(local.extras?.folder) ?? t('publish.diff.noFolder'),
            remote: t('publish.diff.noRemote'),
        },
        {
            field: 'attachments',
            label: t('publish.diff.attachments'),
            local: summarizeAttachments(local),
            remote: t('publish.diff.noRemote'),
        },
    ]
}

function renderZephyrText(value: string | undefined, catalog: ReturnType<typeof buildRefCatalog>): string {
    const raw = String(value ?? '')
    if (!raw.trim()) return ''
    const resolved = renderRefsInText(raw, catalog, { mode: 'html' })
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

function buildPublishSignature(payload: ProviderTest): string {
    return JSON.stringify({
        name: payload.name,
        description: payload.description ?? '',
        steps: payload.steps.map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
            attachments: (step.attachments ?? []).map((attachment) => ({
                name: attachment.name,
                pathOrDataUrl: attachment.pathOrDataUrl,
            })),
        })),
        attachments: (payload.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            pathOrDataUrl: attachment.pathOrDataUrl,
        })),
        objective: safeString(payload.extras?.objective) ?? '',
        preconditions: safeString(payload.extras?.preconditions) ?? '',
        folder: safeString(payload.extras?.folder) ?? '',
        labels: normalizeLabels(payload.extras?.labels),
    })
}

function collectProviderAttachments(payload: ProviderTest): Attachment[] {
    const items = new Map<string, Attachment>()
    const push = (attachment: Attachment | undefined) => {
        if (!attachment) return
        const key = attachment.id || `${attachment.name}::${attachment.pathOrDataUrl}`
        if (!items.has(key)) items.set(key, copyAttachment(attachment))
    }

    ;(payload.attachments ?? []).forEach(push)
    ;(payload.steps ?? []).forEach((step) => (step.attachments ?? []).forEach(push))
    return [...items.values()]
}

function buildAttachmentPlan(local: Attachment[], remote: Attachment[]) {
    const remoteBuckets = bucketAttachmentsByName(remote)
    const localBuckets = bucketAttachmentsByName(local)
    const uploads: Attachment[] = []
    const deleteIds: string[] = []

    for (const attachment of local) {
        const bucket = remoteBuckets.get(attachment.name) ?? []
        if (bucket.length) {
            bucket.shift()
            continue
        }
        uploads.push(copyAttachment(attachment))
    }

    for (const attachment of remote) {
        const bucket = localBuckets.get(attachment.name) ?? []
        if (bucket.length) {
            bucket.shift()
            continue
        }
        if (attachment.id) deleteIds.push(attachment.id)
    }

    return { uploads, deleteIds }
}

function collectAttachmentWarnings(local: Attachment[], remote: Attachment[]): string[] {
    const t = translate
    const warnings: string[] = []
    const plan = buildAttachmentPlan(local, remote)
    if (plan.uploads.length) warnings.push(t('publish.warning.attachmentsUpload'))
    if (plan.deleteIds.length) warnings.push(t('publish.warning.attachmentsDelete'))
    return warnings
}

function summarizeAttachments(payload: ProviderTest): string {
    const t = translate
    const attachments = collectProviderAttachments(payload)
    if (!attachments.length) return t('publish.summary.noAttachments')
    const head = attachments.slice(0, 3).map((attachment) => attachment.name).filter(Boolean)
    return t('publish.summary.attachments', {
        count: attachments.length,
        names: head.length ? ` - ${head.join(', ')}` : '',
    })
}

function bucketAttachmentsByName(attachments: Attachment[]) {
    const buckets = new Map<string, Attachment[]>()
    attachments.forEach((attachment) => {
        const bucket = buckets.get(attachment.name)
        if (bucket) bucket.push(attachment)
        else buckets.set(attachment.name, [attachment])
    })
    return buckets
}

function summarizeProviderSteps(steps: ProviderStep[]): string {
    const t = translate
    if (!steps?.length) return t('publish.summary.stepsZero')
    const head = steps
        .slice(0, 2)
        .map((step) => summarizeText(step.action || step.text || t('publish.summary.empty')))
        .filter(Boolean)
    return t('publish.summary.steps', {
        count: steps.length,
        head: head.length ? ` - ${head.join(' | ')}` : '',
    })
}

function summarizeLabels(value: unknown): string {
    const t = translate
    const labels = normalizeLabels(value)
    return labels.length ? labels.join(', ') : t('publish.summary.noLabels')
}

function normalizeLabels(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean).sort((left, right) => left.localeCompare(right))
        : []
}

function summarizeText(value: string | undefined, limit = 120): string {
    const t = translate
    const text = String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return t('publish.summary.empty')
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

function copyAttachment(attachment: Attachment): Attachment {
    return {
        id: attachment.id,
        name: attachment.name,
        pathOrDataUrl: attachment.pathOrDataUrl,
    }
}
