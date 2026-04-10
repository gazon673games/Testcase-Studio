import type { Step, StepPresentation, StepSnapshot, TestCase, TestDetails } from './domainTypes'

type StepParts = NonNullable<StepPresentation['parts']>

function cloneRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return { ...(value as Record<string, unknown>) }
}

function cloneStepParts(value: unknown): StepParts | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const source = value as Record<string, unknown>
    return {
        action: Array.isArray(source.action) ? [...source.action] as StepParts['action'] : undefined,
        data: Array.isArray(source.data) ? [...source.data] as StepParts['data'] : undefined,
        expected: Array.isArray(source.expected) ? [...source.expected] as StepParts['expected'] : undefined,
    }
}

function pickStepSnapshot(source: Record<string, unknown>): StepSnapshot | undefined {
    const canonical = source.snapshot && typeof source.snapshot === 'object' ? source.snapshot as Record<string, unknown> : undefined
    const legacy = source.raw && typeof source.raw === 'object' ? source.raw as Record<string, unknown> : undefined
    if (!canonical && !legacy && source.action === undefined && source.data === undefined && source.expected === undefined) return undefined
    return {
        action: (canonical?.action ?? legacy?.action ?? source.action) as string | undefined,
        data: (canonical?.data ?? legacy?.data ?? source.data) as string | undefined,
        expected: (canonical?.expected ?? legacy?.expected ?? source.expected) as string | undefined,
    }
}

function pickStepPresentation(source: Record<string, unknown>): StepPresentation | undefined {
    const canonical = source.presentation && typeof source.presentation === 'object'
        ? source.presentation as Record<string, unknown>
        : undefined
    const legacy = source.internal && typeof source.internal === 'object'
        ? source.internal as Record<string, unknown>
        : undefined

    const canonicalMeta = cloneRecord(canonical?.meta)
    const legacyMeta = cloneRecord(legacy?.meta)
    if (legacyMeta && 'attachments' in legacyMeta) delete legacyMeta.attachments

    const next: StepPresentation = {
        note: (canonical?.note ?? legacy?.note) as string | undefined,
        url: (canonical?.url ?? legacy?.url) as string | undefined,
        meta: canonicalMeta ?? legacyMeta,
        parts: cloneStepParts(canonical?.parts) ?? cloneStepParts(legacy?.parts),
    }

    return next.note || next.url || next.meta || next.parts ? next : undefined
}

function pickLegacyAttachments(source: Record<string, unknown>): unknown[] {
    const attachments = source.internal
        && typeof source.internal === 'object'
        && (source.internal as Record<string, unknown>).meta
        && typeof (source.internal as Record<string, unknown>).meta === 'object'
        ? ((source.internal as Record<string, unknown>).meta as Record<string, unknown>).attachments
        : undefined
    return Array.isArray(attachments) ? attachments : []
}

function pickTestDetails(source: Record<string, unknown>): TestDetails | undefined {
    const canonical = source.details && typeof source.details === 'object'
        ? source.details as Record<string, unknown>
        : undefined
    const legacy = source.meta && typeof source.meta === 'object'
        ? source.meta as Record<string, unknown>
        : undefined
    const base = canonical ?? legacy
    if (!base) return undefined

    return {
        ...(base as unknown as TestDetails),
        attributes: (
            canonical?.attributes
            ?? legacy?.attributes
            ?? canonical?.params
            ?? legacy?.params
        ) as Record<string, string> | undefined,
    }
}

export function coerceLegacyStepInput(step: Partial<Step> | null | undefined): Partial<Step> {
    const source = (step ?? {}) as Record<string, unknown>
    const canonicalAttachments = Array.isArray(source.attachments) ? [...source.attachments] : []
    const legacyAttachments = pickLegacyAttachments(source)

    return {
        ...(step ?? {}),
        snapshot: pickStepSnapshot(source),
        presentation: pickStepPresentation(source),
        attachments: [...canonicalAttachments, ...legacyAttachments] as Step['attachments'],
    }
}

export function coerceLegacyTestCaseInput(test: Partial<TestCase> | null | undefined): Partial<TestCase> {
    const source = (test ?? {}) as Record<string, unknown>
    return {
        ...(test ?? {}),
        details: pickTestDetails(source),
    }
}
