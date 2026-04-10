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
    TestDetails,
} from './domainTypes'
import { coerceLegacyStepInput, coerceLegacyTestCaseInput } from './domainLegacyCompatibility'

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

function normalizeAttributes(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (raw == null) continue
        out[key] = typeof raw === 'string' ? raw : String(raw)
    }
    return out
}

function normalizeRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return { ...(value as Record<string, unknown>) }
}

function normalizeTestDetails(value: any): TestDetails {
    const attributes = normalizeAttributes(value?.attributes)

    return {
        attributes,
        tags: Array.isArray(value?.tags) ? value.tags.map((tag: unknown) => String(tag)) : [],
        objective: toOptionalString(value?.objective),
        preconditions: toOptionalString(value?.preconditions),
        status: toOptionalString(value?.status),
        priority: toOptionalString(value?.priority),
        component: toOptionalString(value?.component),
        owner: toOptionalString(value?.owner),
        folder: toOptionalString(value?.folder),
        estimated: toOptionalString(value?.estimated),
    }
}

export function normalizeStep(step: Partial<Step> | null | undefined): Step {
    const source = coerceLegacyStepInput(step)

    const snapshot = {
        action: toOptionalString(source.snapshot?.action) ?? toOptionalString(source.action),
        data: toOptionalString(source.snapshot?.data) ?? toOptionalString(source.data),
        expected: toOptionalString(source.snapshot?.expected) ?? toOptionalString(source.expected),
    }
    const presentation = {
        note: toOptionalString(source.presentation?.note),
        url: toOptionalString(source.presentation?.url),
        meta: source.presentation?.meta && Object.keys(source.presentation.meta).length
            ? { ...source.presentation.meta }
            : undefined,
        parts: {
            action: Array.isArray(source.presentation?.parts?.action)
                ? source.presentation!.parts!.action.map(normalizeStepBlock)
                : [],
            data: Array.isArray(source.presentation?.parts?.data)
                ? source.presentation!.parts!.data.map(normalizeStepBlock)
                : [],
            expected: Array.isArray(source.presentation?.parts?.expected)
                ? source.presentation!.parts!.expected.map(normalizeStepBlock)
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
        source: source.source,
        subSteps: Array.isArray(source.subSteps) ? source.subSteps.map(normalizeSubStep) : [],
        presentation,
        integration: normalizeRecord(source.integration),
        usesShared: toOptionalString(source.usesShared),
        attachments: normalizeAttachments(Array.isArray(source.attachments) ? source.attachments : []),
    }
}

export function normalizeTestCase(test: Partial<TestCase> | null | undefined): TestCase {
    const source = coerceLegacyTestCaseInput(test)
    const details = normalizeTestDetails(source.details)
    return {
        id: ensureId(source.id),
        name: typeof source.name === 'string' && source.name.trim() ? source.name : 'Untitled Test',
        description: toOptionalString(source.description) ?? '',
        steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
        attachments: normalizeAttachments(Array.isArray(source.attachments) ? source.attachments : []),
        links: normalizeLinks(Array.isArray(source.links) ? source.links : []),
        updatedAt: normalizeIso(source.updatedAt),
        details,
        integration: normalizeRecord(source.integration),
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
