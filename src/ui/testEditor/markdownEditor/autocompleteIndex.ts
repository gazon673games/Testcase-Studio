import type { RefPart, RefShared, RefStep, RefTest } from './types'

export type IndexedFieldKind = 'action' | 'data' | 'expected'

export type IndexedPart = {
    part: RefPart
    index: number
    displayText: string
    searchHay: string
}

export type IndexedField = {
    kind: IndexedFieldKind
    text: string
    searchHay: string
    parts: IndexedPart[]
}

export type IndexedStep = {
    step: RefStep
    index: number
    displayBody: string
    searchHay: string
    fields: Record<IndexedFieldKind, IndexedField>
}

export type IndexedOwner = {
    owner: RefTest | RefShared
    ownerId: string
    ownerName: string
    prefix: 'id' | 'shared'
    idLower: string
    nameLower: string
    steps: IndexedStep[]
}

export type AutocompleteIndex = {
    tests: IndexedOwner[]
    shared: IndexedOwner[]
    testIdPrefixes: Map<string, IndexedOwner[]>
    sharedIdPrefixes: Map<string, IndexedOwner[]>
    testNamePrefixes: Map<string, IndexedOwner[]>
    sharedNamePrefixes: Map<string, IndexedOwner[]>
}

type ResolveDisplayText = (value: string | undefined) => string

function buildCompositeFieldText(step: RefStep, kind: IndexedFieldKind): string {
    const topLevel = String(
        kind === 'action'
            ? step.action ?? step.text ?? ''
            : kind === 'data'
                ? step.data ?? ''
                : step.expected ?? ''
    ).trim()
    const blocks = (step.presentation?.parts?.[kind] ?? []).map((part) => String(part.text ?? '').trim()).filter(Boolean)
    return [topLevel, ...blocks].filter(Boolean).join('\n').trim()
}

function getPrimaryStepDisplayText(step: RefStep, resolveDisplayText: ResolveDisplayText) {
    return resolveDisplayText(buildCompositeFieldText(step, 'action') || step.data || step.expected || '')
}

function pushPrefix(map: Map<string, IndexedOwner[]>, value: string, owner: IndexedOwner) {
    const normalized = value.trim().toLowerCase()
    for (let index = 1; index <= normalized.length; index += 1) {
        const prefix = normalized.slice(0, index)
        const bucket = map.get(prefix)
        if (bucket) {
            bucket.push(owner)
        } else {
            map.set(prefix, [owner])
        }
    }
}

function buildIndexedField(
    step: RefStep,
    kind: IndexedFieldKind,
    resolveDisplayText: ResolveDisplayText
): IndexedField {
    const text = resolveDisplayText(buildCompositeFieldText(step, kind))
    const parts = (step.presentation?.parts?.[kind] ?? []).map((part, index) => {
        const displayText = resolveDisplayText(part.text ?? '')
        return {
            part,
            index,
            displayText,
            searchHay: `${kind} part ${index + 1} ${part.text ?? ''} ${displayText}`.toLowerCase(),
        }
    })

    return {
        kind,
        text,
        searchHay: `${kind} ${text}`.toLowerCase(),
        parts,
    }
}

function buildIndexedOwner(
    owner: RefTest | RefShared,
    prefix: 'id' | 'shared',
    resolveDisplayText: ResolveDisplayText
): IndexedOwner {
    const steps = owner.steps.map((step, index) => {
        const displayBody = getPrimaryStepDisplayText(step, resolveDisplayText)
        const rawBody = step.action || step.text || step.data || step.expected || ''

        return {
            step,
            index,
            displayBody,
            searchHay: `${index + 1} ${String(step.id ?? '').toLowerCase()} ${rawBody.toLowerCase()} ${displayBody.toLowerCase()}`,
            fields: {
                action: buildIndexedField(step, 'action', resolveDisplayText),
                data: buildIndexedField(step, 'data', resolveDisplayText),
                expected: buildIndexedField(step, 'expected', resolveDisplayText),
            },
        }
    })

    return {
        owner,
        ownerId: owner.id,
        ownerName: owner.name,
        prefix,
        idLower: owner.id.toLowerCase(),
        nameLower: owner.name.toLowerCase(),
        steps,
    }
}

export function buildAutocompleteIndex(
    allTests: RefTest[],
    sharedSteps: RefShared[],
    resolveDisplayText: ResolveDisplayText
): AutocompleteIndex {
    const tests = allTests.map((test) => buildIndexedOwner(test, 'id', resolveDisplayText))
    const shared = sharedSteps.map((item) => buildIndexedOwner(item, 'shared', resolveDisplayText))

    const testIdPrefixes = new Map<string, IndexedOwner[]>()
    const sharedIdPrefixes = new Map<string, IndexedOwner[]>()
    const testNamePrefixes = new Map<string, IndexedOwner[]>()
    const sharedNamePrefixes = new Map<string, IndexedOwner[]>()

    tests.forEach((owner) => {
        pushPrefix(testIdPrefixes, owner.ownerId, owner)
        pushPrefix(testNamePrefixes, owner.ownerName, owner)
    })
    shared.forEach((owner) => {
        pushPrefix(sharedIdPrefixes, owner.ownerId, owner)
        pushPrefix(sharedNamePrefixes, owner.ownerName, owner)
    })

    return {
        tests,
        shared,
        testIdPrefixes,
        sharedIdPrefixes,
        testNamePrefixes,
        sharedNamePrefixes,
    }
}

function findByPrefix(map: Map<string, IndexedOwner[]>, token: string, fallback: IndexedOwner[]): IndexedOwner | null {
    const normalized = token.trim().toLowerCase()
    if (!normalized) return fallback[0] ?? null
    return map.get(normalized)?.[0] ?? null
}

export function findOwnerMatch(ownerQuery: string, index: AutocompleteIndex): IndexedOwner | null {
    const lowerOwner = ownerQuery.trim().toLowerCase()
    if (!lowerOwner) return null

    if (lowerOwner.startsWith('shared:')) {
        const token = lowerOwner.slice(7)
        return (
            findByPrefix(index.sharedIdPrefixes, token, index.shared) ??
            findByPrefix(index.sharedNamePrefixes, token, index.shared)
        )
    }

    if (lowerOwner.startsWith('id:')) {
        const token = lowerOwner.slice(3)
        return (
            findByPrefix(index.testIdPrefixes, token, index.tests) ??
            findByPrefix(index.testNamePrefixes, token, index.tests)
        )
    }

    return findByPrefix(index.testNamePrefixes, lowerOwner, index.tests) ?? findByPrefix(index.sharedNamePrefixes, lowerOwner, index.shared)
}

export function findStepMatch(owner: IndexedOwner, stepToken: string): IndexedStep | null {
    const token = stepToken.trim().toLowerCase()
    if (!token) return null

    const numeric = Number(token)
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= owner.steps.length) {
        return owner.steps[numeric - 1]
    }

    return owner.steps.find((step) => step.searchHay.includes(token)) ?? null
}
