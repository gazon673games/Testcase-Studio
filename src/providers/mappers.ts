import { v4 as uuid } from 'uuid'
import { normalizeStep, type Attachment, type Step, type SubStep, type TestCase, type TestMeta } from '@core/domain'
import { applyZephyrHtmlPartsParsing } from '@core/zephyrHtmlParts'
import type { ProviderStep, ProviderTest } from '@providers/types'
import type { ExportStep, ExportTest } from '@core/export'

export function fromProviderPayload(
    src: ProviderTest,
    previousSteps: Step[] = [],
    options?: { parseHtmlParts?: boolean; tolerantJsonBeautify?: boolean }
): Pick<TestCase, 'name' | 'description' | 'steps' | 'attachments' | 'updatedAt' | 'meta'> {
    const name = src.name ?? ''
    const description = src.description ?? ''
    const steps = mapProviderSteps(src.steps ?? [], previousSteps, options)
    const attachments = (src.attachments ?? []).map(copyAttachment)
    const updatedAt = src.updatedAt ?? new Date().toISOString()

    const params: Record<string, string> = {}
    const put = (key: string, value: unknown) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value) || typeof value === 'object') {
            params[key] = JSON.stringify(value)
            return
        }
        params[key] = String(value)
    }

    const extras = src.extras ?? {}
    put('key', (extras as any).key)
    put('keyNumber', (extras as any).keyNumber)
    put('status', (extras as any).status)
    put('priority', (extras as any).priority)
    put('component', (extras as any).component)
    put('projectKey', (extras as any).projectKey)
    put('folder', (extras as any).folder)
    put('latestVersion', (extras as any).latestVersion)
    put('lastTestResultStatus', (extras as any).lastTestResultStatus)
    put('owner', (extras as any).owner)
    put('updatedBy', (extras as any).updatedBy)
    put('createdBy', (extras as any).createdBy)
    put('createdOn', (extras as any).createdOn)
    put('updatedOn', (extras as any).updatedOn)
    put('issueLinks', (extras as any).issueLinks)

    const objective = (extras as any).objective ?? null
    const preconditions = (extras as any).preconditions ?? null

    const customFields = (extras as any).customFields as Record<string, unknown> | undefined
    if (customFields && typeof customFields === 'object') {
        for (const [key, value] of Object.entries(customFields)) put(`customFields.${key}`, value)
    }

    const parameters = (extras as any).parameters as { variables?: unknown[]; entries?: unknown[] } | undefined
    if (parameters && typeof parameters === 'object') {
        if ('variables' in parameters) put('parameters.variables', parameters.variables ?? [])
        if ('entries' in parameters) put('parameters.entries', parameters.entries ?? [])
    }

    const meta: TestMeta = {
        tags: [],
        params,
        objective: objective == null ? undefined : String(objective),
        preconditions: preconditions == null ? undefined : String(preconditions),
    }

    return { name, description, steps, attachments, updatedAt, meta }
}

export function toProviderPayload(
    test: Pick<TestCase, 'id' | 'name' | 'description' | 'steps' | 'attachments' | 'meta'> | ExportTest
): ProviderTest {
    const id = (test as any).id
    const name = test.name
    const description = (test as any).description ?? ''
    const attachments = (test as any).attachments ?? []
    const stepsArray: Array<Step | ExportStep> = (test as any).steps ?? []
    const providerSteps = normalizeStepsForProvider(stepsArray)
    return {
        id: id ?? String(Math.random()),
        name,
        description,
        steps: providerSteps,
        attachments: attachments.map(copyAttachment),
        updatedAt: new Date().toISOString(),
    }
}

function mapProviderSteps(
    src: ProviderStep[],
    previousSteps: Step[] = [],
    options?: { parseHtmlParts?: boolean; tolerantJsonBeautify?: boolean }
): Step[] {
    const previous = previousSteps.map(normalizeStep)
    const used = new Set<string>()
    const byProviderId = new Map<string, Step[]>()
    const bySignature = new Map<string, Step[]>()

    for (const step of previous) {
        const providerStepId = safeStr(step.raw?.providerStepId).trim()
        if (providerStepId) pushToQueue(byProviderId, providerStepId, step)
        pushToQueue(bySignature, stepSignature(step), step)
    }

    return (src ?? []).map((providerStep, index) => {
        const providerStepId = safeStr(providerStep.providerStepId).trim() || undefined
        const preserved =
            (providerStepId ? takeUnused(byProviderId.get(providerStepId), used) : undefined) ??
            takeUnused(bySignature.get(stepSignature(providerStep)), used) ??
            (previous[index] && !used.has(previous[index].id) ? previous[index] : undefined)

        if (preserved) used.add(preserved.id)

        const action = safeStr(providerStep.action)
        const data = safeStr(providerStep.data)
        const expected = safeStr(providerStep.expected)
        const text = safeStr(providerStep.text ?? providerStep.action)
        const testCaseKey = safeStr(providerStep.testCaseKey).trim() || undefined
        const nestedSubSteps = buildNestedSubSteps(providerStep.includedTest)

        const mappedStep: Step = {
            id: preserved?.id ?? uuid(),
            action,
            data,
            expected,
            text,
            raw: {
                action,
                data,
                expected,
                ...(providerStepId || preserved?.raw?.providerStepId
                    ? { providerStepId: providerStepId ?? preserved?.raw?.providerStepId }
                    : {}),
                ...(testCaseKey ? { testCaseKey } : {}),
            },
            subSteps: nestedSubSteps.length ? nestedSubSteps : (testCaseKey ? [] : preserved?.subSteps ?? []),
            internal: buildImportedStepInternal(preserved, options?.parseHtmlParts),
            usesShared: preserved?.usesShared,
            attachments: (providerStep.attachments?.length ? providerStep.attachments : preserved?.attachments ?? []).map(copyAttachment),
        }

        if (testCaseKey || providerStep.includedTest?.name) {
            mappedStep.internal = mappedStep.internal ?? { parts: { action: [], data: [], expected: [] } }
            const nextMeta = { ...(mappedStep.internal.meta ?? {}) }
            if (testCaseKey) nextMeta.zephyrIncludedTestKey = testCaseKey
            else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestKey

            const includedName = safeStr(providerStep.includedTest?.name).trim()
            if (includedName) nextMeta.zephyrIncludedTestName = includedName
            else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestName

            if (providerStep.includedTest) nextMeta.zephyrIncludedTestSnapshot = cloneProviderTest(providerStep.includedTest)
            else delete (nextMeta as Record<string, unknown>).zephyrIncludedTestSnapshot

            mappedStep.internal.meta = Object.keys(nextMeta).length ? nextMeta : undefined
        }

        return options?.parseHtmlParts
            ? applyZephyrHtmlPartsParsing(mappedStep, { tolerant: options?.tolerantJsonBeautify })
            : mappedStep
    })
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

function buildImportedStepInternal(preserved: Step | undefined, parseHtmlParts: boolean | undefined): Step['internal'] {
    return {
        ...(preserved?.internal ?? {}),
        parts: parseHtmlParts
            ? {
                action: [...(preserved?.internal?.parts?.action ?? [])],
                data: [...(preserved?.internal?.parts?.data ?? [])],
                expected: [...(preserved?.internal?.parts?.expected ?? [])],
            }
            : {
                action: [],
                data: [],
                expected: [],
            },
    }
}

function normalizeStepsForProvider(src: Array<Step | ExportStep>): ProviderStep[] {
    return (src ?? []).map((step) => {
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

function pushToQueue(map: Map<string, Step[]>, key: string, step: Step) {
    const queue = map.get(key)
    if (queue) {
        queue.push(step)
        return
    }
    map.set(key, [step])
}

function takeUnused(queue: Step[] | undefined, used: Set<string>): Step | undefined {
    if (!queue?.length) return undefined
    while (queue.length) {
        const next = queue.shift()
        if (next && !used.has(next.id)) return next
    }
    return undefined
}

function stepSignature(step: Pick<ProviderStep, 'action' | 'data' | 'expected' | 'text'>): string {
    return [
        safeStr(step.action).trim().toLowerCase(),
        safeStr(step.data).trim().toLowerCase(),
        safeStr(step.expected).trim().toLowerCase(),
        safeStr(step.text ?? step.action).trim().toLowerCase(),
        safeStr((step as ProviderStep).testCaseKey).trim().toLowerCase(),
    ].join('\u0001')
}

function copyAttachment(attachment: Attachment): Attachment {
    return { id: attachment.id, name: attachment.name, pathOrDataUrl: attachment.pathOrDataUrl }
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
