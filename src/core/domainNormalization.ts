import { v4 as uuid } from 'uuid'
import type {
    Attachment,
    Folder,
    ID,
    PartItem,
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

function normalizePartItem(value: any): PartItem {
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
        out[key] = typeof raw === 'string' ? raw : String(raw)
    }
    return out
}

function normalizeTestMeta(value: any): TestMeta {
    return {
        tags: Array.isArray(value?.tags) ? value.tags.map((tag: unknown) => String(tag)) : [],
        params: normalizeParams(value?.params),
        objective: toOptionalString(value?.objective),
        preconditions: toOptionalString(value?.preconditions),
        status: toOptionalString(value?.status),
        priority: toOptionalString(value?.priority),
        component: toOptionalString(value?.component),
        owner: toOptionalString(value?.owner),
        folder: toOptionalString(value?.folder),
        estimated: toOptionalString(value?.estimated),
        testType: toOptionalString(value?.testType),
        automation: toOptionalString(value?.automation),
        assignedTo: toOptionalString(value?.assignedTo),
    }
}

export function normalizeStep(step: Partial<Step> | null | undefined): Step {
    const source = step ?? {}
    const legacyAttachments = Array.isArray((source as any)?.internal?.meta?.attachments)
        ? (source as any).internal.meta.attachments
        : []
    const providerStepId = toOptionalString(
        source.raw?.providerStepId ??
        (source as any)?.providerStepId ??
        (source as any)?.internal?.meta?.providerStepId
    )
    const testCaseKey = toOptionalString(
        source.raw?.testCaseKey ??
        (source as any)?.testCaseKey ??
        (source as any)?.internal?.meta?.zephyrIncludedTestKey
    )

    const rawMeta = (source.internal && typeof source.internal === 'object' && source.internal.meta && typeof source.internal.meta === 'object')
        ? { ...source.internal.meta }
        : undefined
    if (rawMeta && 'attachments' in rawMeta) delete (rawMeta as any).attachments

    return {
        id: ensureId(source.id),
        action: toOptionalString(source.action),
        data: toOptionalString(source.data),
        expected: toOptionalString(source.expected),
        text: toOptionalString(source.text) ?? toOptionalString(source.action) ?? '',
        raw: {
            action: toOptionalString(source.raw?.action) ?? toOptionalString(source.action),
            data: toOptionalString(source.raw?.data) ?? toOptionalString(source.data),
            expected: toOptionalString(source.raw?.expected) ?? toOptionalString(source.expected),
            ...(providerStepId ? { providerStepId } : {}),
            ...(testCaseKey ? { testCaseKey } : {}),
        },
        subSteps: Array.isArray(source.subSteps) ? source.subSteps.map(normalizeSubStep) : [],
        internal: {
            note: toOptionalString(source.internal?.note),
            url: toOptionalString(source.internal?.url),
            meta: rawMeta && Object.keys(rawMeta).length ? rawMeta : undefined,
            parts: {
                action: Array.isArray(source.internal?.parts?.action) ? source.internal.parts.action.map(normalizePartItem) : [],
                data: Array.isArray(source.internal?.parts?.data) ? source.internal.parts.data.map(normalizePartItem) : [],
                expected: Array.isArray(source.internal?.parts?.expected) ? source.internal.parts.expected.map(normalizePartItem) : [],
            },
        },
        usesShared: toOptionalString(source.usesShared),
        attachments: normalizeAttachments([
            ...(Array.isArray(source.attachments) ? source.attachments : []),
            ...legacyAttachments,
        ]),
    }
}

export function normalizeTestCase(test: Partial<TestCase> | null | undefined): TestCase {
    const source = test ?? {}
    return {
        id: ensureId(source.id),
        name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Untitled Test',
        description: toOptionalString(source.description) ?? '',
        steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
        attachments: normalizeAttachments(Array.isArray(source.attachments) ? source.attachments : []),
        links: normalizeLinks(Array.isArray(source.links) ? source.links : []),
        updatedAt: normalizeIso(source.updatedAt),
        meta: normalizeTestMeta(source.meta),
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
