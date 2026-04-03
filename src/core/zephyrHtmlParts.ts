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

export function beautifyZephyrJsonBlocksInStep(step: Step): Step {
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
        const current = getStepFieldValue(step, kind)
        const beautified = maybeBeautifyJsonHtmlBlock(current)
        if (beautified !== current) {
            setStepFieldValue(next, kind, beautified)
            changed = true
        }

        const parts = step.internal?.parts?.[kind] ?? []
        next.internal!.parts![kind] = parts.map((part) => {
            const beautifiedPart = maybeBeautifyJsonHtmlBlock(part.text)
            if (beautifiedPart !== part.text) changed = true
            return beautifiedPart === part.text ? part : { ...part, text: beautifiedPart }
        })
    }

    return changed ? next : step
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
        .map((item) => maybeBeautifyJsonHtmlBlock(item.trim()))
        .filter(Boolean)

    return blocks.length > 1 ? blocks : null
}

function looksLikeHtml(value: string) {
    return /<([a-z][^>\s/]*)\b[^>]*>/i.test(value)
}

function maybeBeautifyJsonHtmlBlock(block: string): string {
    if (!looksLikeJsonBlockCandidate(block)) return block

    const candidate = toJsonCandidate(block)
    if (!candidate) return block

    try {
        const parsed = JSON.parse(candidate.text)
        const beautified = JSON.stringify(parsed, null, 2)
        return wrapBeautifiedJsonHtml(beautified, candidate.wrappers)
    } catch {
        return block
    }
}

function looksLikeJsonBlockCandidate(value: string) {
    return /(?:^|>|\s)(?:\{|\[)/.test(String(value ?? ''))
}

function toJsonCandidate(block: string): { text: string; wrappers: string[] } | null {
    let candidate = stripDecorativeSpans(block)
        .replace(/<(em|strong|code|pre|div|p)\b[^>]*>\s*<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\r\n/g, '\n')

    candidate = decodeHtmlEntities(candidate).trim()

    const wrappers: string[] = []
    let changed = true
    while (changed) {
        changed = false

        for (const tag of ['div', 'p', 'em', 'strong', 'code', 'pre'] as const) {
            const inner = unwrapWholeTag(candidate, tag)
            if (inner == null) continue

            candidate = inner.trim()
            changed = true
            if (tag === 'em' || tag === 'strong' || tag === 'code' || tag === 'pre') wrappers.push(tag)
            break
        }
    }

    if (!looksLikeJson(candidate)) return null
    return { text: candidate, wrappers }
}

function stripDecorativeSpans(value: string) {
    return String(value ?? '')
        .replace(/<span\b[^>]*>/gi, '')
        .replace(/<\/span>/gi, '')
}

function unwrapWholeTag(value: string, tag: 'div' | 'p' | 'em' | 'strong' | 'code' | 'pre') {
    const pattern = new RegExp(`^\\s*<${tag}\\b[^>]*>([\\s\\S]*)<\\/${tag}>\\s*$`, 'i')
    const match = value.match(pattern)
    return match ? match[1] : null
}

function looksLikeJson(value: string) {
    const trimmed = String(value ?? '').trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

function decodeHtmlEntities(value: string) {
    return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_full, entity: string) => {
        const normalized = entity.toLowerCase()

        if (normalized === 'nbsp') return ' '
        if (normalized === 'amp') return '&'
        if (normalized === 'lt') return '<'
        if (normalized === 'gt') return '>'
        if (normalized === 'quot') return '"'
        if (normalized === 'apos') return "'"

        if (normalized.startsWith('#x')) {
            const value = Number.parseInt(normalized.slice(2), 16)
            return Number.isFinite(value) ? String.fromCodePoint(value) : _full
        }

        if (normalized.startsWith('#')) {
            const value = Number.parseInt(normalized.slice(1), 10)
            return Number.isFinite(value) ? String.fromCodePoint(value) : _full
        }

        return _full
    })
}

function wrapBeautifiedJsonHtml(value: string, wrappers: string[]) {
    const escaped = escapeHtml(String(value ?? '')).replace(/\n/g, '<br />')
    return wrappers.reduceRight((current, tag) => `<${tag}>${current}</${tag}>`, escaped)
}

function escapeHtml(value: string) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
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
