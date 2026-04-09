import { v4 as uuid } from 'uuid'
import { normalizeStep, type Attachment, type Step, type SubStep } from '@core/domain'
import { applyZephyrHtmlPartsParsing } from '@core/zephyrHtmlParts'
import type { ExportStep } from '@core/export'
import type { ProviderStep, ProviderTest } from '@providers/types'

export type ProviderStepImportOptions = {
    parseHtmlParts?: boolean
    tolerantJsonBeautify?: boolean
}

export function copyAttachment(attachment: Attachment): Attachment {
    return { id: attachment.id, name: attachment.name, pathOrDataUrl: attachment.pathOrDataUrl }
}

export function mapProviderStepsToDomain(
    sourceSteps: ProviderStep[],
    previousSteps: Step[] = [],
    options?: ProviderStepImportOptions
): Step[] {
    const normalizedPreviousSteps = previousSteps.map(normalizeStep)
    const usedStepIds = new Set<string>()
    const previousByProviderId = new Map<string, Step[]>()
    const previousBySignature = new Map<string, Step[]>()

    for (const step of normalizedPreviousSteps) {
        const providerStepId = safeStr(step.raw?.providerStepId).trim()
        if (providerStepId) pushToQueue(previousByProviderId, providerStepId, step)
        pushToQueue(previousBySignature, buildStepSignature(step), step)
    }

    return (sourceSteps ?? []).map((providerStep, index) => {
        const providerStepId = safeStr(providerStep.providerStepId).trim() || undefined
        const preservedStep =
            (providerStepId ? takeUnused(previousByProviderId.get(providerStepId), usedStepIds) : undefined) ??
            takeUnused(previousBySignature.get(buildStepSignature(providerStep)), usedStepIds) ??
            (normalizedPreviousSteps[index] && !usedStepIds.has(normalizedPreviousSteps[index].id)
                ? normalizedPreviousSteps[index]
                : undefined)

        if (preservedStep) usedStepIds.add(preservedStep.id)

        const action = safeStr(providerStep.action)
        const data = safeStr(providerStep.data)
        const expected = safeStr(providerStep.expected)
        const text = safeStr(providerStep.text ?? providerStep.action)
        const testCaseKey = safeStr(providerStep.testCaseKey).trim() || undefined
        const nestedSubSteps = buildNestedSubSteps(providerStep.includedTest)

        const domainStep: Step = {
            id: preservedStep?.id ?? uuid(),
            action,
            data,
            expected,
            text,
            raw: {
                action,
                data,
                expected,
                ...(providerStepId || preservedStep?.raw?.providerStepId
                    ? { providerStepId: providerStepId ?? preservedStep?.raw?.providerStepId }
                    : {}),
                ...(testCaseKey ? { testCaseKey } : {}),
            },
            subSteps: nestedSubSteps.length ? nestedSubSteps : (testCaseKey ? [] : preservedStep?.subSteps ?? []),
            internal: buildImportedStepInternal(preservedStep, options?.parseHtmlParts),
            usesShared: preservedStep?.usesShared,
            attachments: (providerStep.attachments?.length ? providerStep.attachments : preservedStep?.attachments ?? []).map(copyAttachment),
        }

        attachIncludedTestSnapshot(domainStep, providerStep, testCaseKey)

        return options?.parseHtmlParts
            ? applyZephyrHtmlPartsParsing(domainStep, { tolerant: options?.tolerantJsonBeautify })
            : domainStep
    })
}

export function mapDomainStepsToProvider(
    sourceSteps: Array<Step | ExportStep>
): ProviderStep[] {
    return (sourceSteps ?? []).map((step) => {
        const isDomainStep = 'id' in (step as any)
        if (isDomainStep) {
            const domainStep = step as Step
            return {
                action: safeStr(domainStep.action ?? domainStep.text),
                data: safeStr(domainStep.data),
                expected: safeStr(domainStep.expected),
                text: safeStr(domainStep.text),
                providerStepId: safeStr(domainStep.raw?.providerStepId) || undefined,
                attachments: (domainStep.attachments ?? []).map(copyAttachment),
            }
        }

        const exportStep = step as ExportStep
        return {
            action: safeStr(exportStep.action),
            data: safeStr(exportStep.data),
            expected: safeStr(exportStep.expected),
            text: '',
            attachments: (exportStep.attachments ?? []).map(copyAttachment),
        }
    })
}

function attachIncludedTestSnapshot(step: Step, providerStep: ProviderStep, testCaseKey: string | undefined) {
    if (!testCaseKey && !providerStep.includedTest?.name) return

    step.internal = step.internal ?? { parts: { action: [], data: [], expected: [] } }
    const nextMeta = { ...(step.internal.meta ?? {}) }

    if (testCaseKey) nextMeta.zephyrIncludedTestKey = testCaseKey
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestKey

    const includedName = safeStr(providerStep.includedTest?.name).trim()
    if (includedName) nextMeta.zephyrIncludedTestName = includedName
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestName

    if (providerStep.includedTest) nextMeta.zephyrIncludedTestSnapshot = cloneProviderTest(providerStep.includedTest)
    else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestSnapshot

    step.internal.meta = Object.keys(nextMeta).length ? nextMeta : undefined
}

function buildNestedSubSteps(test: ProviderTest | undefined, seen = new Set<string>()): SubStep[] {
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

function buildImportedStepInternal(previousStep: Step | undefined, shouldKeepParts: boolean | undefined): Step['internal'] {
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

function buildStepSignature(step: Pick<ProviderStep, 'action' | 'data' | 'expected' | 'text'>): string {
    return [
        safeStr(step.action).trim().toLowerCase(),
        safeStr(step.data).trim().toLowerCase(),
        safeStr(step.expected).trim().toLowerCase(),
        safeStr(step.text ?? step.action).trim().toLowerCase(),
        safeStr((step as ProviderStep).testCaseKey).trim().toLowerCase(),
    ].join('\u0001')
}

function cloneProviderTest(test: ProviderTest): ProviderTest {
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
            attachments: (step.attachments ?? []).map(copyAttachment),
        })),
        attachments: (test.attachments ?? []).map(copyAttachment),
        updatedAt: safeStr(test.updatedAt) || undefined,
        extras:
            test.extras && typeof test.extras === 'object'
                ? structuredClone(test.extras)
                : undefined,
    }
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}
