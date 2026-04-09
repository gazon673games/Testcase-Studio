import { v4 as uuid } from 'uuid'
import type { Step } from './domain'
import {
    beautifyZephyrJsonHtmlBlock,
    inspectZephyrJsonHtmlBlock,
    splitZephyrHtmlBlocks,
    type ZephyrJsonBeautifyDiagnostics,
    type ZephyrJsonBeautifyFailure,
    type ZephyrJsonBeautifyOptions,
} from './zephyrJsonHtml'
export {
    ZEPHYR_PARSE_HTML_PARTS_KEY,
    isZephyrHtmlPartsEnabled,
    preserveZephyrHtmlPartsFlag,
    setZephyrHtmlPartsEnabled,
} from './zephyrHtmlPartsFlag'
export type {
    ZephyrJsonBeautifyDiagnostics,
    ZephyrJsonBeautifyFailure,
    ZephyrJsonBeautifyOptions,
} from './zephyrJsonHtml'

export function applyZephyrHtmlPartsParsing(step: Step, options?: ZephyrJsonBeautifyOptions): Step {
    const next: Step = {
        ...step,
        internal: {
            ...(step.internal ?? {}),
            parts: {
                action: [],
                data: [],
                expected: [],
            },
        },
    }

    parseStepFieldIntoHtmlParts(next, 'action', options)
    parseStepFieldIntoHtmlParts(next, 'data', options)
    parseStepFieldIntoHtmlParts(next, 'expected', options)

    return next
}

export function beautifyZephyrJsonBlocksInStep(step: Step, options?: ZephyrJsonBeautifyOptions): Step {
    const next: Step = {
        ...step,
        internal: {
            ...(step.internal ?? {}),
            parts: {
                action: [...(step.internal?.parts?.action ?? [])],
                data: [...(step.internal?.parts?.data ?? [])],
                expected: [...(step.internal?.parts?.expected ?? [])],
            },
        },
    }

    let changed = false

    for (const kind of ['action', 'data', 'expected'] as const) {
        const current = readStepFieldValue(step, kind)
        const beautified = beautifyZephyrJsonHtmlBlock(current, options)
        if (beautified !== current) {
            writeStepFieldValue(next, kind, beautified)
            changed = true
        }

        const parts = step.internal?.parts?.[kind] ?? []
        next.internal!.parts![kind] = parts.map((part) => {
            const beautifiedPart = beautifyZephyrJsonHtmlBlock(part.text, options)
            if (beautifiedPart !== part.text) changed = true
            return beautifiedPart === part.text ? part : { ...part, text: beautifiedPart }
        })
    }

    return changed ? next : step
}

export function inspectZephyrJsonBeautifyStep(
    step: Step,
    options?: ZephyrJsonBeautifyOptions
): ZephyrJsonBeautifyDiagnostics {
    const failures: ZephyrJsonBeautifyFailure[] = []
    let candidateCount = 0

    for (const kind of ['action', 'data', 'expected'] as const) {
        const current = readStepFieldValue(step, kind)
        const fieldAttempt = inspectZephyrJsonHtmlBlock(current, options)
        if (fieldAttempt.candidate) candidateCount += 1
        if (fieldAttempt.failure) {
            failures.push({
                kind,
                source: 'field',
                ...fieldAttempt.failure,
            })
        }

        const parts = step.internal?.parts?.[kind] ?? []
        for (const part of parts) {
            const partAttempt = inspectZephyrJsonHtmlBlock(part.text, options)
            if (partAttempt.candidate) candidateCount += 1
            if (partAttempt.failure) {
                failures.push({
                    kind,
                    source: 'part',
                    partId: part.id,
                    ...partAttempt.failure,
                })
            }
        }
    }

    return { candidateCount, failures }
}

function parseStepFieldIntoHtmlParts(step: Step, kind: 'action' | 'data' | 'expected', options?: ZephyrJsonBeautifyOptions) {
    const current = readStepFieldValue(step, kind)
    const blocks = splitZephyrHtmlBlocks(current, options)
    const previousParts = step.internal?.parts?.[kind] ?? []

    if (!blocks) {
        step.internal!.parts![kind] = []
        return
    }

    const [topLevel, ...rest] = blocks
    writeStepFieldValue(step, kind, topLevel)
    step.internal!.parts![kind] = rest.map((text, index) => ({
        id: previousParts[index]?.id ?? uuid(),
        text,
    }))
}

function readStepFieldValue(step: Step, kind: 'action' | 'data' | 'expected') {
    switch (kind) {
        case 'action':
            return String(step.action ?? step.text ?? '')
        case 'data':
            return String(step.data ?? '')
        case 'expected':
            return String(step.expected ?? '')
    }
}

function writeStepFieldValue(step: Step, kind: 'action' | 'data' | 'expected', value: string) {
    switch (kind) {
        case 'action':
            step.action = value
            step.text = value
            break
        case 'data':
            step.data = value
            break
        case 'expected':
            step.expected = value
            break
    }
}
