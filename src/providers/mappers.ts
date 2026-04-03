import { v4 as uuid } from 'uuid'
import { normalizeStep, type Attachment, type Step, type TestCase, type TestMeta } from '@core/domain'
import { applyZephyrHtmlPartsParsing } from '@core/zephyrHtmlParts'
import type { ProviderStep, ProviderTest } from '@providers/types'
import type { ExportStep, ExportTest } from '@core/export'

export function fromProviderPayload(
    src: ProviderTest,
    previousSteps: Step[] = [],
    options?: { parseHtmlParts?: boolean }
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
    options?: { parseHtmlParts?: boolean }
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
            },
            subSteps: preserved?.subSteps ?? [],
            internal: preserved?.internal ?? { parts: { action: [], data: [], expected: [] } },
            usesShared: preserved?.usesShared,
            attachments: (providerStep.attachments?.length ? providerStep.attachments : preserved?.attachments ?? []).map(copyAttachment),
        }

        return options?.parseHtmlParts ? applyZephyrHtmlPartsParsing(mappedStep) : mappedStep
    })
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
    ].join('\u0001')
}

function copyAttachment(attachment: Attachment): Attachment {
    return { id: attachment.id, name: attachment.name, pathOrDataUrl: attachment.pathOrDataUrl }
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}
