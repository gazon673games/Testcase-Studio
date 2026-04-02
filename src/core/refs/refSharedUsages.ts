import type { SharedStep, TestCase, TestMeta } from '../domain'
import { buildRefCatalog } from './refCatalog'
import { extractWikiRefs } from './refParsing'
import { resolveWikiRef } from './refResolve'
import type { RefKind, RefOwner, SharedUsage } from './refTypes'

type OwnerTextSource = {
    ownerType: 'test' | 'shared'
    ownerId: string
    ownerName: string
    id: string
    label: string
    text: string
    stepId?: string
}

export function collectSharedUsages(
    shared: SharedStep,
    tests: TestCase[],
    sharedLibrary: SharedStep[]
): SharedUsage[] {
    return buildSharedUsageIndex(tests, sharedLibrary).get(shared.id) ?? []
}

export function buildSharedUsageIndex(
    tests: TestCase[],
    sharedLibrary: SharedStep[]
): Map<string, SharedUsage[]> {
    const catalog = buildRefCatalog(tests, sharedLibrary)
    const buckets = new Map<string, Map<string, SharedUsage>>()

    const push = (sharedId: string, usage: SharedUsage) => {
        let bucket = buckets.get(sharedId)
        if (!bucket) {
            bucket = new Map<string, SharedUsage>()
            buckets.set(sharedId, bucket)
        }
        bucket.set(usage.id, usage)
    }

    for (const test of tests) {
        test.steps.forEach((step, index) => {
            if (!step.usesShared) return

            push(step.usesShared, {
                id: `usesShared:test:${test.id}:${step.id}`,
                ownerType: 'test',
                ownerId: test.id,
                ownerName: test.name,
                sourceStepId: step.id,
                sourceLabel: `Step ${index + 1}`,
                kind: 'usesShared',
            })
        })
    }

    for (const nestedShared of sharedLibrary) {
        nestedShared.steps.forEach((step, index) => {
            if (!step.usesShared) return
            if (nestedShared.id === step.usesShared) return

            push(step.usesShared, {
                id: `usesShared:shared:${nestedShared.id}:${step.id}`,
                ownerType: 'shared',
                ownerId: nestedShared.id,
                ownerName: nestedShared.name,
                sourceStepId: step.id,
                sourceLabel: `Shared step ${index + 1}`,
                kind: 'usesShared',
            })
        })
    }

    const allSources: OwnerTextSource[] = [
        ...tests.flatMap((test) => collectOwnerTextSources({ ownerType: 'test', owner: test })),
        ...sharedLibrary.flatMap((shared) => collectOwnerTextSources({ ownerType: 'shared', owner: shared })),
    ]

    for (const source of allSources) {
        for (const ref of extractWikiRefs(source.text)) {
            const resolved = resolveWikiRef(ref, catalog)
            if (!resolved.ok || resolved.ownerType !== 'shared') continue

            const sharedId = resolved.ownerId
            if (!sharedId) continue

            if (sharedId === source.ownerId && source.ownerType === 'shared') {
                // Internal refs inside the same shared item do not count as external usage.
                continue
            }

            push(sharedId, {
                id: `ref:${source.ownerType}:${source.ownerId}:${source.id}:${resolved.raw}`,
                ownerType: source.ownerType,
                ownerId: source.ownerId,
                ownerName: source.ownerName,
                sourceStepId: source.stepId,
                sourceLabel: source.label,
                kind: 'ref',
                raw: resolved.raw,
            })
        }
    }

    return new Map([...buckets.entries()].map(([sharedId, usageMap]) => [sharedId, [...usageMap.values()]]))
}

function collectOwnerTextSources(owner: RefOwner): OwnerTextSource[] {
    const out: OwnerTextSource[] = []

    const pushText = (id: string, label: string, text: string | undefined, stepId?: string) => {
        if (typeof text !== 'string' || !text.includes('[[')) return

        out.push({
            ownerType: owner.ownerType,
            ownerId: owner.owner.id,
            ownerName: owner.owner.name,
            id,
            label,
            text,
            stepId,
        })
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
