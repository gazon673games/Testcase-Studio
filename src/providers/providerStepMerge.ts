import { normalizeStep, type Step } from '@core/domain'
import type { ProviderStep } from '@providers/types'

export function buildImportedStepInternal(previousStep: Step | undefined, shouldKeepParts: boolean | undefined): Step['internal'] {
    return {
        ...(previousStep?.internal ?? {}),
        parts: shouldKeepParts
            ? {
                action: [...(previousStep?.internal?.parts?.action ?? [])],
                data: [...(previousStep?.internal?.parts?.data ?? [])],
                expected: [...(previousStep?.internal?.parts?.expected ?? [])],
            }
            : {
                action: [],
                data: [],
                expected: [],
            },
    }
}

export function createPreviousStepMatcher(previousSteps: Step[]) {
    const normalizedPreviousSteps = previousSteps.map(normalizeStep)
    const usedStepIds = new Set<string>()
    const previousBySourceId = new Map<string, Step[]>()
    const previousBySignature = new Map<string, Step[]>()

    for (const step of normalizedPreviousSteps) {
        const sourceStepId = safeStr(step.source?.sourceStepId).trim()
        if (sourceStepId) pushToQueue(previousBySourceId, sourceStepId, step)
        pushToQueue(previousBySignature, buildProviderStepSignature(step), step)
    }

    return {
        match(providerStep: ProviderStep, index: number) {
            const sourceStepId = safeStr(providerStep.providerStepId).trim() || undefined
            const matched =
                (sourceStepId ? takeUnused(previousBySourceId.get(sourceStepId), usedStepIds) : undefined) ??
                takeUnused(previousBySignature.get(buildProviderStepSignature(providerStep)), usedStepIds) ??
                (normalizedPreviousSteps[index] && !usedStepIds.has(normalizedPreviousSteps[index].id)
                    ? normalizedPreviousSteps[index]
                    : undefined)

            if (matched) usedStepIds.add(matched.id)
            return matched
        },
    }
}

export function buildProviderStepSignature(step: Pick<ProviderStep, 'action' | 'data' | 'expected' | 'text'> & { testCaseKey?: string }): string {
    return [
        safeStr(step.action).trim().toLowerCase(),
        safeStr(step.data).trim().toLowerCase(),
        safeStr(step.expected).trim().toLowerCase(),
        safeStr(step.text ?? step.action).trim().toLowerCase(),
        safeStr(step.testCaseKey).trim().toLowerCase(),
    ].join('\u0001')
}

function pushToQueue(map: Map<string, Step[]>, key: string, step: Step) {
    const queue = map.get(key)
    if (queue) {
        queue.push(step)
        return
    }
    map.set(key, [step])
}

function takeUnused(queue: Step[] | undefined, usedStepIds: Set<string>): Step | undefined {
    if (!queue?.length) return undefined

    while (queue.length) {
        const next = queue.shift()
        if (next && !usedStepIds.has(next.id)) return next
    }

    return undefined
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}
