import type { Step, TestCase } from './domain'
import { makeStepRef } from './refs'

export function canReferenceTestStep(step: Step): boolean {
    return (['action', 'data', 'expected'] as const).some((kind) => hasReferenceableField(step, kind))
}

export function buildReferenceStepsFromTest(test: TestCase, selectedStepIds: string[]): Step[] {
    const allowed = new Set(selectedStepIds)
    if (!allowed.size) return []

    return test.steps
        .filter((step) => allowed.has(step.id))
        .filter(canReferenceTestStep)
        .map((step) => buildReferenceStep(test, step))
}

function buildReferenceStep(test: TestCase, step: Step): Step {
    const action = hasReferenceableField(step, 'action')
        ? `[[${makeStepRef('test', test.id, step.id, 'action')}]]`
        : ''
    const data = hasReferenceableField(step, 'data')
        ? `[[${makeStepRef('test', test.id, step.id, 'data')}]]`
        : ''
    const expected = hasReferenceableField(step, 'expected')
        ? `[[${makeStepRef('test', test.id, step.id, 'expected')}]]`
        : ''

    return {
        id: crypto.randomUUID(),
        action,
        data,
        expected,
        text: action || data || expected,
        raw: {
            action,
            data,
            expected,
        },
        subSteps: [],
        internal: {
            parts: {
                action: [],
                data: [],
                expected: [],
            },
            meta: {
                referenceSourceTestId: test.id,
                referenceSourceStepId: step.id,
            },
        },
        attachments: [],
    }
}

function hasReferenceableField(step: Step, kind: 'action' | 'data' | 'expected'): boolean {
    const topLevel = getFieldValue(step, kind).trim()
    if (topLevel) return true

    const parts = step.internal?.parts?.[kind] ?? []
    return parts.some((part) => part.export !== false && String(part.text ?? '').trim())
}

function getFieldValue(step: Step, kind: 'action' | 'data' | 'expected') {
    if (kind === 'action') return String(step.action ?? step.text ?? '')
    if (kind === 'data') return String(step.data ?? '')
    return String(step.expected ?? '')
}
