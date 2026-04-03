import { v4 as uuid } from 'uuid'
import type { Step, TestMeta } from './domain'

export const ZEPHYR_PARSE_HTML_PARTS_KEY = '__zephyr.parseHtmlParts'

export function isZephyrHtmlPartsEnabled(meta: Pick<TestMeta, 'params'> | undefined): boolean {
    const raw = String(meta?.params?.[ZEPHYR_PARSE_HTML_PARTS_KEY] ?? '').trim().toLowerCase()
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'
}

export function setZephyrHtmlPartsEnabled(meta: TestMeta | undefined, enabled: boolean): TestMeta {
    const nextMeta: TestMeta = {
        ...(meta ?? { tags: [], params: {} }),
        tags: [...(meta?.tags ?? [])],
        params: { ...(meta?.params ?? {}) },
    }

    if (enabled) nextMeta.params![ZEPHYR_PARSE_HTML_PARTS_KEY] = 'true'
    else delete nextMeta.params![ZEPHYR_PARSE_HTML_PARTS_KEY]

    return nextMeta
}

export function preserveZephyrHtmlPartsFlag(existing: TestMeta | undefined, next: TestMeta | undefined): TestMeta | undefined {
    if (!isZephyrHtmlPartsEnabled(existing)) return next
    return setZephyrHtmlPartsEnabled(next, true)
}

export function applyZephyrHtmlPartsParsing(step: Step): Step {
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

    applyFieldParsing(next, 'action')
    applyFieldParsing(next, 'data')
    applyFieldParsing(next, 'expected')

    return next
}

function applyFieldParsing(step: Step, kind: 'action' | 'data' | 'expected') {
    const current = getStepFieldValue(step, kind)
    const blocks = splitZephyrHtmlBlocks(current)
    const previousParts = step.internal?.parts?.[kind] ?? []

    if (!blocks) {
        step.internal!.parts![kind] = []
        return
    }

    const [topLevel, ...rest] = blocks
    setStepFieldValue(step, kind, topLevel)
    step.internal!.parts![kind] = rest.map((text, index) => ({
        id: previousParts[index]?.id ?? uuid(),
        text,
    }))
}

function splitZephyrHtmlBlocks(value: string | undefined): string[] | null {
    const source = String(value ?? '').trim()
    if (!source) return null
    if (!looksLikeHtml(source)) return null
    if (!/<br\s*\/?>/i.test(source)) return null

    const blocks = source
        .replace(/\r\n/g, '\n')
        .split(/(?:\s*<br\s*\/?>\s*){2,}/i)
        .map((item) => item.trim())
        .filter(Boolean)

    return blocks.length > 1 ? blocks : null
}

function looksLikeHtml(value: string) {
    return /<([a-z][^>\s/]*)\b[^>]*>/i.test(value)
}

function getStepFieldValue(step: Step, kind: 'action' | 'data' | 'expected') {
    switch (kind) {
        case 'action':
            return String(step.action ?? step.text ?? '')
        case 'data':
            return String(step.data ?? '')
        case 'expected':
            return String(step.expected ?? '')
    }
}

function setStepFieldValue(step: Step, kind: 'action' | 'data' | 'expected', value: string) {
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
