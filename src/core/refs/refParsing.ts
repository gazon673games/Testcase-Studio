import type { ParsedWikiRef, RefKind, RefOwnerType } from './refTypes'

export const WIKI_REF_RE = /(!)?\[\[([^[\]]+)\]\]/g

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

export function parseWikiRefBody(body: string, raw: string, image: boolean): ParsedWikiRef {
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

export function buildRefTargetKey(
    ownerType: RefOwnerType,
    ownerId: string,
    stepId: string,
    kind: RefKind,
    partId?: string
) {
    return `${ownerType}:${ownerId}#${stepId}.${kind}${partId ? `@${partId}` : ''}`
}
