import type { PartItem, SharedStep, Step, TestCase, TestMeta } from './domain'

export type RefOwnerType = 'test' | 'shared'
export type RefKind = 'action' | 'data' | 'expected'

export type RefOwner =
    | { ownerType: 'test'; owner: TestCase }
    | { ownerType: 'shared'; owner: SharedStep }

export interface RefCatalog {
    testsById: Map<string, TestCase>
    testsByName: Map<string, TestCase>
    sharedById: Map<string, SharedStep>
    sharedByName: Map<string, SharedStep>
}

export interface ParsedWikiRef {
    raw: string
    body: string
    image: boolean
    ownerType?: RefOwnerType
    ownerId?: string
    ownerName?: string
    stepId?: string
    stepIndex?: number
    kind: RefKind
    partId?: string
    canonical: boolean
}

export interface ResolvedWikiRef {
    raw: string
    body: string
    image: boolean
    ok: boolean
    canonical: boolean
    ownerType?: RefOwnerType
    ownerId?: string
    ownerName?: string
    stepId?: string
    kind: RefKind
    partId?: string
    preview: string
    label: string
    brokenReason?: string
}

export interface SharedUsage {
    id: string
    ownerType: RefOwnerType
    ownerId: string
    ownerName: string
    sourceStepId?: string
    sourceLabel: string
    kind: 'usesShared' | 'ref'
    raw?: string
}

const WIKI_REF_RE = /(!)?\[\[([^[\]]+)\]\]/g

export function buildRefCatalog(allTests: TestCase[], sharedSteps: SharedStep[]): RefCatalog {
    const testsById = new Map<string, TestCase>()
    const testsByName = new Map<string, TestCase>()
    const sharedById = new Map<string, SharedStep>()
    const sharedByName = new Map<string, SharedStep>()

    for (const test of allTests) {
        testsById.set(test.id, test)
        if (!testsByName.has(test.name)) testsByName.set(test.name, test)
    }
    for (const shared of sharedSteps) {
        sharedById.set(shared.id, shared)
        if (!sharedByName.has(shared.name)) sharedByName.set(shared.name, shared)
    }

    return { testsById, testsByName, sharedById, sharedByName }
}

export function makeStepRef(
    ownerType: RefOwnerType,
    ownerId: string,
    stepId: string,
    kind: RefKind = 'action',
    partId?: string
) {
    const prefix = ownerType === 'shared' ? 'shared' : 'id'
    return `${prefix}:${ownerId}#${stepId}.${kind}${partId ? `@${partId}` : ''}`
}

export function extractWikiRefs(src: string): ParsedWikiRef[] {
    const out: ParsedWikiRef[] = []
    for (const match of src.matchAll(WIKI_REF_RE)) {
        const image = Boolean(match[1])
        const body = String(match[2] ?? '').trim()
        const raw = image ? `![[${body}]]` : `[[${body}]]`
        out.push(parseWikiRefBody(body, raw, image))
    }
    return out
}

export function resolveRefsInText(src: string, catalog: RefCatalog): string {
    return src.replace(WIKI_REF_RE, (_full, imageMarker: string | undefined, body: string) => {
        const image = Boolean(imageMarker)
        const parsed = parseWikiRefBody(String(body).trim(), image ? `![[${body}]]` : `[[${body}]]`, image)
        const resolved = resolveWikiRef(parsed, catalog)
        return resolved.ok ? resolved.preview : parsed.raw
    })
}

export function inspectWikiRefs(src: string, catalog: RefCatalog): ResolvedWikiRef[] {
    return extractWikiRefs(src).map((parsed) => resolveWikiRef(parsed, catalog))
}

export function resolveWikiRef(parsed: ParsedWikiRef, catalog: RefCatalog): ResolvedWikiRef {
    const base: ResolvedWikiRef = {
        raw: parsed.raw,
        body: parsed.body,
        image: parsed.image,
        ok: false,
        canonical: parsed.canonical,
        ownerType: parsed.ownerType,
        ownerId: parsed.ownerId,
        ownerName: parsed.ownerName,
        stepId: parsed.stepId,
        kind: parsed.kind,
        partId: parsed.partId,
        preview: parsed.raw,
        label: parsed.raw,
    }

    const targetOwner = findOwner(parsed, catalog)
    if (!targetOwner) {
        return { ...base, brokenReason: 'Source not found' }
    }

    const step = parsed.stepId
        ? targetOwner.owner.steps.find((candidate) => candidate.id === parsed.stepId)
        : typeof parsed.stepIndex === 'number'
            ? targetOwner.owner.steps[parsed.stepIndex]
            : undefined
    if (!step) {
        return {
            ...base,
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            brokenReason: 'Step not found',
        }
    }

    const preview = getStepRefValue(step, parsed.kind, parsed.partId)
    if (preview == null) {
        return {
            ...base,
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReason: parsed.partId ? 'Part not found' : 'Field is empty',
        }
    }

    const stepTitle = trimPreview(step.action || step.text || 'Step')
    const labelPrefix = targetOwner.ownerType === 'shared' ? 'Shared' : 'Test'
    return {
        ...base,
        ok: true,
        ownerType: targetOwner.ownerType,
        ownerId: targetOwner.owner.id,
        ownerName: targetOwner.owner.name,
        stepId: step.id,
        preview,
        label: `${labelPrefix}: ${targetOwner.owner.name} -> ${stepTitle}`,
    }
}

export function collectSharedUsages(
    shared: SharedStep,
    tests: TestCase[],
    sharedLibrary: SharedStep[]
): SharedUsage[] {
    const usages: SharedUsage[] = []
    const push = (usage: SharedUsage) => {
        if (!usages.some((item) => item.id === usage.id)) usages.push(usage)
    }

    for (const test of tests) {
        test.steps.forEach((step, index) => {
            if (step.usesShared === shared.id) {
                push({
                    id: `usesShared:test:${test.id}:${step.id}`,
                    ownerType: 'test',
                    ownerId: test.id,
                    ownerName: test.name,
                    sourceStepId: step.id,
                    sourceLabel: `Step ${index + 1}`,
                    kind: 'usesShared',
                })
            }
        })
        for (const source of collectOwnerTextSources({ ownerType: 'test', owner: test })) {
            for (const ref of extractWikiRefs(source.text)) {
                const resolved = resolveWikiRef(ref, buildRefCatalog(tests, sharedLibrary))
                if (!resolved.ok || resolved.ownerType !== 'shared' || resolved.ownerId !== shared.id) continue
                push({
                    id: `ref:test:${test.id}:${source.id}:${resolved.raw}`,
                    ownerType: 'test',
                    ownerId: test.id,
                    ownerName: test.name,
                    sourceStepId: source.stepId,
                    sourceLabel: source.label,
                    kind: 'ref',
                    raw: resolved.raw,
                })
            }
        }
    }

    for (const nestedShared of sharedLibrary) {
        nestedShared.steps.forEach((step, index) => {
            if (nestedShared.id === shared.id) return
            if (step.usesShared === shared.id) {
                push({
                    id: `usesShared:shared:${nestedShared.id}:${step.id}`,
                    ownerType: 'shared',
                    ownerId: nestedShared.id,
                    ownerName: nestedShared.name,
                    sourceStepId: step.id,
                    sourceLabel: `Shared step ${index + 1}`,
                    kind: 'usesShared',
                })
            }
        })
        for (const source of collectOwnerTextSources({ ownerType: 'shared', owner: nestedShared })) {
            for (const ref of extractWikiRefs(source.text)) {
                const resolved = resolveWikiRef(ref, buildRefCatalog(tests, sharedLibrary))
                if (!resolved.ok || resolved.ownerType !== 'shared' || resolved.ownerId !== shared.id) continue
                push({
                    id: `ref:shared:${nestedShared.id}:${source.id}:${resolved.raw}`,
                    ownerType: 'shared',
                    ownerId: nestedShared.id,
                    ownerName: nestedShared.name,
                    sourceStepId: source.stepId,
                    sourceLabel: source.label,
                    kind: 'ref',
                    raw: resolved.raw,
                })
            }
        }
    }

    return usages
}

function parseWikiRefBody(body: string, raw: string, image: boolean): ParsedWikiRef {
    const sharedMatch = body.match(/^shared:([^#]+)#([^.@]+)(?:\.(action|data|expected))?(?:@([^@]+))?$/i)
    if (sharedMatch) {
        return {
            raw,
            body,
            image,
            ownerType: 'shared',
            ownerId: sharedMatch[1].trim(),
            stepId: sharedMatch[2].trim(),
            kind: normalizeKind(sharedMatch[3]),
            partId: sharedMatch[4]?.trim(),
            canonical: true,
        }
    }

    const idMatch = body.match(/^id:([^#]+)#([^.@]+)(?:\.(action|data|expected))?(?:@([^@]+))?$/i)
    if (idMatch) {
        return {
            raw,
            body,
            image,
            ownerType: 'test',
            ownerId: idMatch[1].trim(),
            stepId: idMatch[2].trim(),
            kind: normalizeKind(idMatch[3]),
            partId: idMatch[4]?.trim(),
            canonical: true,
        }
    }

    const legacyMatch = body.match(/^(.+?)#(\d+)(?:\.(action|data|expected))?$/i)
    if (legacyMatch) {
        return {
            raw,
            body,
            image,
            ownerName: legacyMatch[1].trim(),
            stepIndex: Math.max(0, Number(legacyMatch[2]) - 1),
            kind: normalizeKind(legacyMatch[3]),
            canonical: false,
        }
    }

    return {
        raw,
        body,
        image,
        kind: 'action',
        canonical: false,
    }
}

function normalizeKind(value: string | undefined): RefKind {
    return value === 'data' || value === 'expected' ? value : 'action'
}

function findOwner(parsed: ParsedWikiRef, catalog: RefCatalog): RefOwner | null {
    if (parsed.ownerType === 'test' && parsed.ownerId) {
        const owner = catalog.testsById.get(parsed.ownerId)
        return owner ? { ownerType: 'test', owner } : null
    }
    if (parsed.ownerType === 'shared' && parsed.ownerId) {
        const owner = catalog.sharedById.get(parsed.ownerId)
        return owner ? { ownerType: 'shared', owner } : null
    }
    if (parsed.ownerName) {
        const owner = catalog.testsByName.get(parsed.ownerName)
        return owner ? { ownerType: 'test', owner } : null
    }
    return null
}

function getStepRefValue(step: Step, kind: RefKind, partId?: string): string | null {
    if (partId) {
        const part = findPart(step.internal?.parts?.[kind], partId)
        if (!part) return null
        const text = String(part.text ?? '').trim()
        return text.length ? text : null
    }
    const parts = step.internal?.parts?.[kind] ?? []
    const topLevel = kind === 'action' ? step.action ?? step.text ?? '' : (step as any)[kind] ?? ''
    const value = parts.length
        ? [String(topLevel ?? '').trim(), ...parts.map((part) => String(part.text ?? '').trim())].filter(Boolean).join('\n')
        : String(topLevel ?? '')
    const text = String(value ?? '').trim()
    return text.length ? text : null
}

function findPart(parts: PartItem[] | undefined, partId: string): PartItem | undefined {
    return Array.isArray(parts) ? parts.find((part) => part.id === partId) : undefined
}

function trimPreview(value: string, limit = 180): string {
    const withoutTags = value.replace(/<[^>]+>/g, ' ')
    const normalized = withoutTags.replace(/\s+/g, ' ').trim()
    if (!normalized) return ''
    return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

type OwnerTextSource = {
    id: string
    label: string
    text: string
    stepId?: string
}

function collectOwnerTextSources(owner: RefOwner): OwnerTextSource[] {
    const out: OwnerTextSource[] = []
    const pushText = (id: string, label: string, text: string | undefined, stepId?: string) => {
        if (typeof text === 'string' && text.includes('[[')) out.push({ id, label, text, stepId })
    }

    if (owner.ownerType === 'test') {
        pushText(`${owner.owner.id}:description`, 'Description', owner.owner.description)
        pushMetaFields(owner.owner.meta, owner.owner.id, pushText)
    }

    owner.owner.steps.forEach((step, index) => {
        pushText(`${owner.owner.id}:${step.id}:action`, `Step ${index + 1} action`, step.action ?? step.text, step.id)
        pushText(`${owner.owner.id}:${step.id}:data`, `Step ${index + 1} data`, step.data, step.id)
        pushText(`${owner.owner.id}:${step.id}:expected`, `Step ${index + 1} expected`, step.expected, step.id)
        for (const kind of ['action', 'data', 'expected'] as RefKind[]) {
            const parts = step.internal?.parts?.[kind] ?? []
            parts.forEach((part, partIndex) => {
                pushText(
                    `${owner.owner.id}:${step.id}:${kind}:${part.id}`,
                    `Step ${index + 1} ${kind} part ${partIndex + 1}`,
                    part.text,
                    step.id
                )
            })
        }
    })

    return out
}

function pushMetaFields(
    meta: TestMeta | undefined,
    ownerId: string,
    pushText: (id: string, label: string, text: string | undefined, stepId?: string) => void
) {
    pushText(`${ownerId}:objective`, 'Objective', meta?.objective)
    pushText(`${ownerId}:preconditions`, 'Preconditions', meta?.preconditions)
}
