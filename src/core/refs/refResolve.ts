import type { PartItem, Step } from '../domain'
import { buildRefTargetKey, extractWikiRefs, parseWikiRefBody, WIKI_REF_RE } from './refParsing'
import { renderResolvedValue, trimPreview } from './refFormatting'
import type {
    ParsedWikiRef,
    RefCatalog,
    RefKind,
    RefOwner,
    ResolveRefsInTextOptions,
    ResolvedWikiRef,
} from './refTypes'

type ResolveContext = {
    stack: string[]
}

type OwnerLookup =
    | { owner: RefOwner }
    | { error: 'missing' | 'ambiguous' }

export function resolveRefsInText(src: string, catalog: RefCatalog): string {
    return resolveRefs(src, catalog, { mode: 'plain' })
}

export function renderRefsInText(src: string, catalog: RefCatalog, options: ResolveRefsInTextOptions = {}): string {
    return resolveRefs(src, catalog, options)
}

function resolveRefs(src: string, catalog: RefCatalog, options: ResolveRefsInTextOptions = {}): string {
    return resolveRefsInternal(src, catalog, options, { stack: [] }).text
}

function resolveRefsInternal(
    src: string,
    catalog: RefCatalog,
    options: ResolveRefsInTextOptions,
    context: ResolveContext
): { text: string; broken: ResolvedWikiRef[] } {
    const mode = options.mode ?? 'plain'
    const broken: ResolvedWikiRef[] = []
    const text = src.replace(WIKI_REF_RE, (_full, imageMarker: string | undefined, body: string) => {
        const image = Boolean(imageMarker)
        const parsed = parseWikiRefBody(String(body).trim(), image ? `![[${body}]]` : `[[${body}]]`, image)
        const resolved = resolveWikiRef(parsed, catalog, context)
        if (!resolved.ok) {
            broken.push(resolved)
            return parsed.raw
        }
        return renderResolvedValue(resolved, mode)
    })
    return { text, broken }
}

export function inspectWikiRefs(src: string, catalog: RefCatalog): ResolvedWikiRef[] {
    return extractWikiRefs(src).map((parsed) => resolveWikiRef(parsed, catalog, { stack: [] }))
}

export function resolveWikiRef(parsed: ParsedWikiRef, catalog: RefCatalog, context: ResolveContext = { stack: [] }): ResolvedWikiRef {
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

    const ownerLookup = findOwner(parsed, catalog)
    if ('error' in ownerLookup) {
        return {
            ...base,
            brokenReasonCode: ownerLookup.error === 'ambiguous' ? 'source-ambiguous' : 'source-missing',
            brokenReason: ownerLookup.error === 'ambiguous' ? 'Source name is ambiguous' : 'Source not found',
        }
    }

    const targetOwner = ownerLookup.owner
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
            brokenReasonCode: 'step-missing',
            brokenReason: 'Step not found',
        }
    }

    const refKey = buildRefTargetKey(targetOwner.ownerType, targetOwner.owner.id, step.id, parsed.kind, parsed.partId)
    if (context.stack.includes(refKey) || context.stack.length >= 24) {
        return {
            ...base,
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: 'cycle-detected',
            brokenReason: 'Reference cycle detected',
        }
    }

    const rawPreview = getStepRefValue(step, parsed.kind, parsed.partId)
    if (rawPreview == null) {
        return {
            ...base,
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: parsed.partId ? 'part-missing' : 'field-empty',
            brokenReason: parsed.partId ? 'Part not found' : 'Field is empty',
        }
    }

    const nested = rawPreview.includes('[[')
        ? resolveRefsInternal(rawPreview, catalog, { mode: 'plain' }, { stack: [...context.stack, refKey] })
        : { text: rawPreview, broken: [] as ResolvedWikiRef[] }

    if (nested.broken.length > 0) {
        const first = nested.broken[0]
        return {
            ...base,
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: first.brokenReasonCode,
            brokenReason: first.brokenReason,
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
        preview: nested.text,
        label: `${labelPrefix}: ${targetOwner.owner.name} -> ${stepTitle}`,
    }
}

function findOwner(parsed: ParsedWikiRef, catalog: RefCatalog): OwnerLookup {
    if (parsed.ownerType === 'test' && parsed.ownerId) {
        const owner = catalog.testsById.get(parsed.ownerId)
        return owner ? { owner: { ownerType: 'test', owner } } : { error: 'missing' }
    }

    if (parsed.ownerType === 'shared' && parsed.ownerId) {
        const owner = catalog.sharedById.get(parsed.ownerId)
        return owner ? { owner: { ownerType: 'shared', owner } } : { error: 'missing' }
    }

    if (parsed.ownerName) {
        const owners = catalog.testsByName.get(parsed.ownerName) ?? []
        if (owners.length === 1) return { owner: { ownerType: 'test', owner: owners[0] } }
        return owners.length > 1 ? { error: 'ambiguous' } : { error: 'missing' }
    }

    return { error: 'missing' }
}

function getStepRefValue(step: Step, kind: RefKind, partId?: string): string | null {
    if (partId) {
        const part = findPart(step.internal?.parts?.[kind], partId)
        if (!part) return null
        const text = String(part.text ?? '').trim()
        return text.length ? text : null
    }

    const parts = (step.internal?.parts?.[kind] ?? []).filter((part) => part.export !== false)
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
