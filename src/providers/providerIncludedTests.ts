import { v4 as uuid } from 'uuid'
import type { Step, SubStep } from '@core/domain'
import type { ProviderStep, ProviderTest } from '@providers/types'

export function attachIncludedTestSnapshot(step: Step, providerStep: ProviderStep, includedCaseRef: string | undefined) {
    if (!includedCaseRef && !providerStep.includedTest?.name) return

    step.internal = step.internal ?? { parts: { action: [], data: [], expected: [] } }
    const nextMeta = { ...(step.internal.meta ?? {}) }

    if (includedCaseRef) nextMeta.zephyrIncludedTestKey = includedCaseRef
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestKey

    const includedName = safeStr(providerStep.includedTest?.name).trim()
    if (includedName) nextMeta.zephyrIncludedTestName = includedName
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestName

    if (providerStep.includedTest) nextMeta.zephyrIncludedTestSnapshot = cloneProviderTest(providerStep.includedTest)
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestSnapshot

    step.internal.meta = Object.keys(nextMeta).length ? nextMeta : undefined
}

export function buildNestedSubSteps(test: ProviderTest | undefined, seen = new Set<string>()): SubStep[] {
    if (!test) return []

    const normalizedId = safeStr(test.id).trim().toUpperCase()
    if (!normalizedId || seen.has(normalizedId)) return []
    seen.add(normalizedId)

    const result: SubStep[] = []

    for (let index = 0; index < (test.steps ?? []).length; index += 1) {
        const step = test.steps[index]
        if (step.testCaseKey && step.includedTest) {
            result.push(...buildNestedSubSteps(step.includedTest, new Set(seen)))
            continue
        }

        const title = summarizeProviderStep(step, index)
        const text = summarizeProviderStepBody(step)
        result.push({
            id: uuid(),
            title,
            ...(text ? { text } : {}),
        })
    }

    return result
}

export function cloneProviderTest(test: ProviderTest): ProviderTest {
    return {
        id: safeStr(test.id),
        name: safeStr(test.name),
        description: safeStr(test.description) || undefined,
        steps: (test.steps ?? []).map((step) => ({
            action: safeStr(step.action),
            data: safeStr(step.data),
            expected: safeStr(step.expected),
            text: safeStr(step.text),
            providerStepId: safeStr(step.providerStepId) || undefined,
            testCaseKey: safeStr(step.testCaseKey) || undefined,
            includedTest: step.includedTest ? cloneProviderTest(step.includedTest) : undefined,
            attachments: step.attachments ? [...step.attachments] : [],
        })),
        attachments: [...(test.attachments ?? [])],
        updatedAt: safeStr(test.updatedAt) || undefined,
        extras:
            test.extras && typeof test.extras === 'object'
                ? structuredClone(test.extras)
                : undefined,
    }
}

function summarizeProviderStep(step: ProviderStep, index: number) {
    const title = toPlainText(step.action || step.text || '')
    return title ? `#${index + 1} ${title}` : `#${index + 1}`
}

function summarizeProviderStepBody(step: ProviderStep) {
    const chunks = [
        toPlainText(step.data),
        toPlainText(step.expected),
    ].filter(Boolean)
    return chunks.join('\n\n')
}

function toPlainText(value: unknown) {
    return String(value ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}
