import type { PartItem, Step } from '../domain'
import { trimPreview } from './refFormatting'
import type { ParsedWikiRef, RefCatalog, RefKind, RefOwner, ResolvedWikiRef } from './refTypes'

export type ResolveContext = {
    stack: string[]
}

export type OwnerLookup =
    | { owner: RefOwner }
    | { error: 'missing' | 'ambiguous' }

export function buildBaseResolvedRef(parsed: ParsedWikiRef): ResolvedWikiRef {
    return {
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
}

export function buildBrokenResolvedRef(
    base: ResolvedWikiRef,
    patch: Partial<ResolvedWikiRef> & Pick<ResolvedWikiRef, 'brokenReasonCode' | 'brokenReason'>
): ResolvedWikiRef {
    return {
        ...base,
        ...patch,
    }
}

export function buildSuccessfulResolvedRef(
    base: ResolvedWikiRef,
    targetOwner: RefOwner,
    step: Step,
    preview: string
): ResolvedWikiRef {
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

export function findOwner(parsed: ParsedWikiRef, catalog: RefCatalog): OwnerLookup {
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

export function findTargetStep(targetOwner: RefOwner, parsed: ParsedWikiRef) {
    return parsed.stepId
        ? targetOwner.owner.steps.find((candidate) => candidate.id === parsed.stepId)
        : typeof parsed.stepIndex === 'number'
            ? targetOwner.owner.steps[parsed.stepIndex]
            : undefined
}

export function getStepRefValue(step: Step, kind: RefKind, partId?: string): string | null {
    if (partId) {
        const part = findPart(step.internal?.parts?.[kind], partId)
        if (!part) return null
        const text = String(part.text ?? '').trim()
        return text.length ? text : null
    }

    const parts = (step.internal?.parts?.[kind] ?? []).filter((part) => part.export !== false)
    const topLevel = getTopLevelStepValue(step, kind)
    const value = parts.length
        ? [String(topLevel ?? '').trim(), ...parts.map((part) => String(part.text ?? '').trim())].filter(Boolean).join('\n')
        : String(topLevel ?? '')
    const text = String(value ?? '').trim()
    return text.length ? text : null
}

function getTopLevelStepValue(step: Step, kind: RefKind): string {
    if (kind === 'action') return step.action ?? step.text ?? ''
    if (kind === 'data') return step.data ?? ''
    return step.expected ?? ''
}

function findPart(parts: PartItem[] | undefined, partId: string): PartItem | undefined {
    return Array.isArray(parts) ? parts.find((part) => part.id === partId) : undefined
}
