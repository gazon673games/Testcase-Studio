import { v4 as uuid } from 'uuid'
import type {
    Attachment,
    Folder,
    ID,
    StepBlock,
    RootState,
    SharedStep,
    Step,
    SubStep,
    TestCase,
    TestCaseLink,
    TestMeta,
} from './domainTypes'

export function nowISO() {
    return new Date().toISOString()
}

const LEGACY_PROVIDER_PARAM_KEYS = new Set([
    'key',
    'keyNumber',
    'projectKey',
    'latestVersion',
    'lastTestResultStatus',
    'updatedBy',
    'createdBy',
    'createdOn',
    'updatedOn',
    'issueLinks',
    'parameters.variables',
    'parameters.entries',
])

function toOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return value == null ? undefined : String(value)
    const next = value.trim()
    return next.length ? next : undefined
}

function toOptionalBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined
}

function ensureId(value: unknown): ID {
    return typeof value === 'string' && value.trim() ? value.trim() : uuid()
}

function normalizeIso(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value : nowISO()
}

function normalizeAttachmentEntry(value: any): Attachment | null {
    if (!value || typeof value !== 'object') return null
    const name = typeof value.name === 'string' ? value.name : 'attachment'
    const pathOrDataUrl =
        typeof value.pathOrDataUrl === 'string'
            ? value.pathOrDataUrl
            : typeof value.path === 'string'
                ? value.path
                : ''
    if (!name && !pathOrDataUrl) return null
    return {
        id: ensureId(value.id),
        name,
        pathOrDataUrl,
    }
}

function attachmentKey(value: any): string {
    if (value && typeof value.id === 'string' && value.id.trim()) return `id:${value.id.trim()}`
    const name = typeof value?.name === 'string' ? value.name : ''
    const pathOrDataUrl =
        typeof value?.pathOrDataUrl === 'string'
            ? value.pathOrDataUrl
            : typeof value?.path === 'string'
                ? value.path
                : ''
    return `path:${name}::${pathOrDataUrl}`
}

function normalizeAttachments(values: unknown[]): Attachment[] {
    const out = new Map<string, Attachment>()
    for (const value of values) {
        const normalized = normalizeAttachmentEntry(value)
        if (!normalized) continue
        out.set(attachmentKey(value), normalized)
    }
    return [...out.values()]
}

function normalizeStepBlock(value: any): StepBlock {
    return {
        id: ensureId(value?.id),
        text: typeof value?.text === 'string' ? value.text : '',
        export: toOptionalBoolean(value?.export),
    }
}

function normalizeSubStep(value: any): SubStep {
    return {
        id: ensureId(value?.id),
        title: toOptionalString(value?.title),
        text: toOptionalString(value?.text),
    }
}

function normalizeLinks(values: unknown[]): TestCaseLink[] {
    const out: TestCaseLink[] = []
    for (const value of values) {
        const provider = value && typeof value === 'object' ? (value as any).provider : undefined
        const externalId = value && typeof value === 'object' ? (value as any).externalId : undefined
        if ((provider === 'zephyr' || provider === 'allure') && typeof externalId === 'string' && externalId.trim()) {
            out.push({ provider, externalId: externalId.trim() })
        }
    }
    return out
}

function normalizeParams(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (raw == null) continue
        if (LEGACY_PROVIDER_PARAM_KEYS.has(key) || key.startsWith('customFields.')) continue
        out[key] = typeof raw === 'string' ? raw : String(raw)
    }
    return out
}

function normalizeStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined
    const items = value
        .map((item) => toOptionalString(item))
        .filter((item): item is string => Boolean(item))
    return items.length ? items : undefined
}

function normalizeRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return { ...(value as Record<string, unknown>) }
}

function parseLegacyStructuredParam(value: unknown): unknown {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (!raw) return undefined
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

function normalizeExternalParameters(value: unknown, legacyParams?: Record<string, string>) {
    const record = normalizeRecord(value)
    const variables =
        (record && Array.isArray(record.variables) ? [...record.variables] : undefined) ??
        (Array.isArray(parseLegacyStructuredParam(legacyParams?.['parameters.variables']))
            ? [...(parseLegacyStructuredParam(legacyParams?.['parameters.variables']) as unknown[])]
            : undefined)
    const entries =
        (record && Array.isArray(record.entries) ? [...record.entries] : undefined) ??
        (Array.isArray(parseLegacyStructuredParam(legacyParams?.['parameters.entries']))
            ? [...(parseLegacyStructuredParam(legacyParams?.['parameters.entries']) as unknown[])]
            : undefined)

    if (!variables?.length && !entries?.length) return undefined
    return {
        ...(variables?.length ? { variables } : {}),
        ...(entries?.length ? { entries } : {}),
    }
}

function normalizeExternalMeta(value: any, legacyParams?: Record<string, string>) {
    const explicit = normalizeRecord(value)
    const customFieldsFromExplicit = normalizeRecord(explicit?.customFields)
    const customFieldsFromLegacy = Object.fromEntries(
        Object.entries(legacyParams ?? {})
            .filter(([key]) => key.startsWith('customFields.'))
            .map(([key, raw]) => [key.slice('customFields.'.length), parseLegacyStructuredParam(raw)])
    )

    const customFields =
        Object.keys(customFieldsFromExplicit ?? {}).length || Object.keys(customFieldsFromLegacy).length
            ? {
                ...(customFieldsFromLegacy ?? {}),
                ...(customFieldsFromExplicit ?? {}),
            }
            : undefined

    const issueLinks =
        normalizeStringArray(explicit?.issueLinks) ??
        normalizeStringArray(parseLegacyStructuredParam(legacyParams?.issueLinks))

    const parameters = normalizeExternalParameters(explicit?.parameters, legacyParams)

    const next = {
        key: toOptionalString(explicit?.key ?? legacyParams?.key),
        keyNumber: toOptionalString(explicit?.keyNumber ?? legacyParams?.keyNumber),
        projectKey: toOptionalString(explicit?.projectKey ?? legacyParams?.projectKey),
        latestVersion:
            typeof explicit?.latestVersion === 'boolean'
                ? explicit.latestVersion
                : legacyParams?.latestVersion === 'true'
                    ? true
                    : legacyParams?.latestVersion === 'false'
                        ? false
                        : undefined,
        lastTestResultStatus: toOptionalString(explicit?.lastTestResultStatus ?? legacyParams?.lastTestResultStatus),
        updatedBy: toOptionalString(explicit?.updatedBy ?? legacyParams?.updatedBy),
        createdBy: toOptionalString(explicit?.createdBy ?? legacyParams?.createdBy),
        createdOn: toOptionalString(explicit?.createdOn ?? legacyParams?.createdOn),
        updatedOn: toOptionalString(explicit?.updatedOn ?? legacyParams?.updatedOn),
        issueLinks,
        customFields,
        parameters,
    }

    return Object.values(next).some((item) => item !== undefined) ? next : undefined
}

function normalizePublication(value: any, legacyParams?: Record<string, string>) {
    const explicit = normalizeRecord(value)
    const customFields = normalizeRecord(explicit?.customFields)
    const next = {
        type: toOptionalString(
            explicit?.type ??
            value?.testType ??
            customFields?.['Test Type'] ??
            parseLegacyStructuredParam(legacyParams?.['customFields.Test Type'])
        ),
        automation: toOptionalString(
            explicit?.automation ??
            value?.automation ??
            customFields?.Automation ??
            parseLegacyStructuredParam(legacyParams?.['customFields.Automation'])
        ),
        assignedTo: toOptionalString(
            explicit?.assignedTo ??
            value?.assignedTo ??
            customFields?.['Assigned to'] ??
            parseLegacyStructuredParam(legacyParams?.['customFields.Assigned to'])
        ),
    }

    return Object.values(next).some((item) => item !== undefined) ? next : undefined
}

function normalizeTestDetails(value: any): TestMeta {
    const attributes = normalizeParams(value?.attributes ?? value?.params)
    const publication = normalizePublication(value?.publication ?? value, value?.params)
    const external = normalizeExternalMeta(value?.external ?? value, value?.params)

    return {
        attributes,
        params: attributes,
        tags: Array.isArray(value?.tags) ? value.tags.map((tag: unknown) => String(tag)) : [],
        objective: toOptionalString(value?.objective),
        preconditions: toOptionalString(value?.preconditions),
        status: toOptionalString(value?.status),
        priority: toOptionalString(value?.priority),
        component: toOptionalString(value?.component),
        owner: toOptionalString(value?.owner),
        folder: toOptionalString(value?.folder),
        estimated: toOptionalString(value?.estimated),
        publication,
        external,
    }
}

export function normalizeStep(step: Partial<Step> | null | undefined): Step {
    const source = step ?? {}
    const legacyAttachments = Array.isArray((source as any)?.internal?.meta?.attachments)
        ? (source as any).internal.meta.attachments
        : []
    const sourceStepId = toOptionalString(
        source.source?.sourceStepId ??
        (source as any)?.providerStepId ??
        (source.raw as any)?.providerStepId ??
        (source as any)?.internal?.meta?.providerStepId
    )
    const includedCaseRef = toOptionalString(
        source.source?.includedCaseRef ??
        (source as any)?.testCaseKey ??
        (source.raw as any)?.testCaseKey ??
        (source as any)?.internal?.meta?.zephyrIncludedTestKey
    )

    const rawMeta = (source.presentation && typeof source.presentation === 'object' && source.presentation.meta && typeof source.presentation.meta === 'object')
        ? { ...source.presentation.meta }
        : (source.internal && typeof source.internal === 'object' && source.internal.meta && typeof source.internal.meta === 'object')
            ? { ...source.internal.meta }
        : undefined
    if (rawMeta && 'attachments' in rawMeta) delete (rawMeta as any).attachments

    const snapshot = {
        action: toOptionalString(source.snapshot?.action ?? source.raw?.action) ?? toOptionalString(source.action),
        data: toOptionalString(source.snapshot?.data ?? source.raw?.data) ?? toOptionalString(source.data),
        expected: toOptionalString(source.snapshot?.expected ?? source.raw?.expected) ?? toOptionalString(source.expected),
    }
    const presentation = {
        note: toOptionalString(source.presentation?.note ?? source.internal?.note),
        url: toOptionalString(source.presentation?.url ?? source.internal?.url),
        meta: rawMeta && Object.keys(rawMeta).length ? rawMeta : undefined,
        parts: {
            action: Array.isArray(source.presentation?.parts?.action)
                ? source.presentation!.parts!.action.map(normalizeStepBlock)
                : Array.isArray(source.internal?.parts?.action)
                    ? source.internal.parts.action.map(normalizeStepBlock)
                    : [],
            data: Array.isArray(source.presentation?.parts?.data)
                ? source.presentation!.parts!.data.map(normalizeStepBlock)
                : Array.isArray(source.internal?.parts?.data)
                    ? source.internal.parts.data.map(normalizeStepBlock)
                    : [],
            expected: Array.isArray(source.presentation?.parts?.expected)
                ? source.presentation!.parts!.expected.map(normalizeStepBlock)
                : Array.isArray(source.internal?.parts?.expected)
                    ? source.internal.parts.expected.map(normalizeStepBlock)
                    : [],
        },
    }

    return {
        id: ensureId(source.id),
        action: toOptionalString(source.action),
        data: toOptionalString(source.data),
        expected: toOptionalString(source.expected),
        text: toOptionalString(source.text) ?? toOptionalString(source.action) ?? '',
        snapshot,
        raw: snapshot,
        source:
            sourceStepId || includedCaseRef
                ? {
                    ...(sourceStepId ? { sourceStepId } : {}),
                    ...(includedCaseRef ? { includedCaseRef } : {}),
                }
                : undefined,
        subSteps: Array.isArray(source.subSteps) ? source.subSteps.map(normalizeSubStep) : [],
        presentation,
        internal: presentation,
        usesShared: toOptionalString(source.usesShared),
        attachments: normalizeAttachments([
            ...(Array.isArray(source.attachments) ? source.attachments : []),
            ...legacyAttachments,
        ]),
    }
}

export function normalizeTestCase(test: Partial<TestCase> | null | undefined): TestCase {
    const source = test ?? {}
    const details = normalizeTestDetails(source.details ?? source.meta)
    return {
        id: ensureId(source.id),
        name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Untitled Test',
        description: toOptionalString(source.description) ?? '',
        steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
        attachments: normalizeAttachments(Array.isArray(source.attachments) ? source.attachments : []),
        links: normalizeLinks(Array.isArray(source.links) ? source.links : []),
        updatedAt: normalizeIso(source.updatedAt),
        details,
        meta: details,
        exportCfg: {
            enabled: typeof source.exportCfg?.enabled === 'boolean' ? source.exportCfg.enabled : true,
        },
    }
}

function normalizeNode(node: Folder | TestCase | any): Folder | TestCase {
    return Array.isArray(node?.children)
        ? normalizeFolder(node, toOptionalString(node?.name) ?? 'Folder')
        : normalizeTestCase(node)
}

export function normalizeFolder(folder: Partial<Folder> | null | undefined, fallbackName = 'Folder'): Folder {
    const source = folder ?? {}
    return {
        id: ensureId(source.id),
        name: typeof source.name === 'string' && source.name.trim() ? source.name : fallbackName,
        iconKey: toOptionalString(source.iconKey),
        alias: toOptionalString(source.alias),
        children: Array.isArray(source.children) ? source.children.map(normalizeNode) : [],
    }
}

export function normalizeSharedStep(shared: Partial<SharedStep> | null | undefined): SharedStep {
    const source = shared ?? {}
    return {
        id: ensureId(source.id),
        name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Shared Step',
        steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
        updatedAt: normalizeIso(source.updatedAt),
    }
}

export function normalizeRootState(state: Partial<RootState> | null | undefined): RootState {
    const source = state ?? {}
    return {
        root: normalizeFolder(source.root, 'Root'),
        sharedSteps: Array.isArray(source.sharedSteps) ? source.sharedSteps.map(normalizeSharedStep) : [],
    }
}
