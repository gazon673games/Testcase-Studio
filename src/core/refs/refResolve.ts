import { buildRefTargetKey, extractWikiRefs, parseWikiRefBody, WIKI_REF_RE } from './refParsing'
import { renderResolvedValue } from './refFormatting'
import {
    type ResolveContext,
    buildBaseResolvedRef,
    buildBrokenResolvedRef,
    buildSuccessfulResolvedRef,
    findOwner,
    findTargetStep,
    getStepRefValue,
} from './refResolveHelpers'
import type {
    ParsedWikiRef,
    RefCatalog,
    ResolveRefsInTextOptions,
    ResolvedWikiRef,
} from './refTypes'

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
    const base = buildBaseResolvedRef(parsed)

    const ownerLookup = findOwner(parsed, catalog)
    if ('error' in ownerLookup) {
        return buildBrokenResolvedRef(base, {
            brokenReasonCode: ownerLookup.error === 'ambiguous' ? 'source-ambiguous' : 'source-missing',
            brokenReason: ownerLookup.error === 'ambiguous' ? 'Source name is ambiguous' : 'Source not found',
        })
    }

    const targetOwner = ownerLookup.owner
    const step = findTargetStep(targetOwner, parsed)

    if (!step) {
        return buildBrokenResolvedRef(base, {
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            brokenReasonCode: 'step-missing',
            brokenReason: 'Step not found',
        })
    }

    const refKey = buildRefTargetKey(targetOwner.ownerType, targetOwner.owner.id, step.id, parsed.kind, parsed.partId)
    if (context.stack.includes(refKey) || context.stack.length >= 24) {
        return buildBrokenResolvedRef(base, {
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: 'cycle-detected',
            brokenReason: 'Reference cycle detected',
        })
    }

    const rawPreview = getStepRefValue(step, parsed.kind, parsed.partId)
    if (rawPreview == null) {
        return buildBrokenResolvedRef(base, {
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: parsed.partId ? 'part-missing' : 'field-empty',
            brokenReason: parsed.partId ? 'Part not found' : 'Field is empty',
        })
    }

    const nested = rawPreview.includes('[[')
        ? resolveRefsInternal(rawPreview, catalog, { mode: 'plain' }, { stack: [...context.stack, refKey] })
        : { text: rawPreview, broken: [] as ResolvedWikiRef[] }

    if (nested.broken.length > 0) {
        const first = nested.broken[0]
        return buildBrokenResolvedRef(base, {
            ownerType: targetOwner.ownerType,
            ownerId: targetOwner.owner.id,
            ownerName: targetOwner.owner.name,
            stepId: step.id,
            brokenReasonCode: first.brokenReasonCode,
            brokenReason: first.brokenReason,
        })
    }

    return buildSuccessfulResolvedRef(base, targetOwner, step, nested.text)
}
