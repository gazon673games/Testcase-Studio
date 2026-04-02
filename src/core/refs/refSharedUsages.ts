import type { SharedStep, TestCase, TestMeta } from '../domain'
import { buildRefCatalog } from './refCatalog'
import { extractWikiRefs } from './refParsing'
import { resolveWikiRef } from './refResolve'
import type { RefKind, RefOwner, SharedUsage } from './refTypes'

type OwnerTextSource = {
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
    const usages: SharedUsage[] = []
    const catalog = buildRefCatalog(tests, sharedLibrary)

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
                const resolved = resolveWikiRef(ref, catalog)
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
                const resolved = resolveWikiRef(ref, catalog)
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
