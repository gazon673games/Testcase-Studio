import { HTML_ENTITIES, JSON_VALUE_END_CHARS, JSON_VALUE_START_CHARS } from './zephyrJsonHtmlConstants'

export type ZephyrJsonBeautifyOptions = { tolerant?: boolean }

export type ZephyrJsonBeautifyFailure = {
    kind: 'action' | 'data' | 'expected'
    source: 'field' | 'part'
    partId?: string
    original: string
    candidate: string
    repaired?: string
    strictError: string
    tolerantError?: string
}

export type ZephyrJsonBeautifyDiagnostics = {
    candidateCount: number
    failures: ZephyrJsonBeautifyFailure[]
}

type JsonBlockAnalysis = {
    output: string
    candidate: boolean
    changed: boolean
    failure?: Omit<ZephyrJsonBeautifyFailure, 'kind' | 'source' | 'partId'>
}

export function splitZephyrHtmlBlocks(value: string | undefined, options?: ZephyrJsonBeautifyOptions): string[] | null {
    const source = String(value ?? '').trim()
    if (!source) return null
    if (!looksLikeHtml(source)) return null
    if (!/<br\s*\/?>/i.test(source)) return null

    const blocks = source
        .replace(/\r\n/g, '\n')
        .split(/(?:\s*<br\s*\/?>\s*){2,}/i)
        .map((item) => beautifyZephyrJsonHtmlBlock(item.trim(), options))
        .filter(Boolean)

    return blocks.length > 1 ? blocks : null
}

export function beautifyZephyrJsonHtmlBlock(block: string, options?: ZephyrJsonBeautifyOptions): string {
    return analyzeZephyrJsonHtmlBlock(block, options).output
}

export function inspectZephyrJsonHtmlBlock(
    block: string,
    options?: ZephyrJsonBeautifyOptions
): JsonBlockAnalysis {
    return analyzeZephyrJsonHtmlBlock(block, options)
}

function analyzeZephyrJsonHtmlBlock(block: string, options?: ZephyrJsonBeautifyOptions): JsonBlockAnalysis {
    if (!looksLikeJsonBlockCandidate(block)) return { output: block, candidate: false, changed: false }

    const candidate = toJsonCandidate(block)
    if (!candidate) return { output: block, candidate: false, changed: false }

    const parsedResult = parseJsonCandidate(candidate.text, options)
    if (parsedResult.parsed == null) {
        return {
            output: block,
            candidate: true,
            changed: false,
            failure: {
                original: block,
                candidate: candidate.text,
                repaired: parsedResult.repaired,
                strictError: parsedResult.strictError ?? 'Unknown JSON.parse error',
                tolerantError: parsedResult.tolerantError,
            },
        }
    }

    try {
        const beautified = JSON.stringify(parsedResult.parsed, null, 2)
        const output = wrapBeautifiedJsonHtml(beautified, candidate.wrappers)
        return { output, candidate: true, changed: output !== block }
    } catch {
        return { output: block, candidate: true, changed: false }
    }
}

function parseJsonCandidate(text: string, options?: ZephyrJsonBeautifyOptions): {
    parsed: unknown | null
    strictError?: string
    repaired?: string
    tolerantError?: string
} {
    try {
        return { parsed: JSON.parse(text) }
    } catch (error) {
        const strictError = error instanceof Error ? error.message : String(error)
        if (!options?.tolerant) return { parsed: null, strictError }

        const repaired = repairJsonText(text)
        if (repaired === text) return { parsed: null, strictError }

        try {
            return { parsed: JSON.parse(repaired), strictError, repaired }
        } catch (repairError) {
            return {
                parsed: null,
                strictError,
                repaired,
                tolerantError: repairError instanceof Error ? repairError.message : String(repairError),
            }
        }
    }
}

function looksLikeHtml(value: string) {
    return /<([a-z][^>\s/]*)\b[^>]*>/i.test(value)
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
        if (HTML_ENTITIES[normalized]) return HTML_ENTITIES[normalized]
        if (normalized.startsWith('#x')) {
            const code = Number.parseInt(normalized.slice(2), 16)
            return Number.isFinite(code) ? String.fromCodePoint(code) : _full
        }
        if (normalized.startsWith('#')) {
            const code = Number.parseInt(normalized.slice(1), 10)
            return Number.isFinite(code) ? String.fromCodePoint(code) : _full
        }
        return _full
    })
}

function repairJsonText(value: string) {
    let current = String(value ?? '').replace(/\r\n/g, '\n')

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const repaired = removeTrailingCommas(insertImplicitCommas(current))
        if (repaired === current) break
        current = repaired
    }

    return current
}

function insertImplicitCommas(source: string) {
    let out = ''
    let inString = false
    let escaped = false

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index]

        if (inString) {
            out += char
            if (escaped) {
                escaped = false
                continue
            }
            if (char === '\\') {
                escaped = true
                continue
            }
            if (char === '"') inString = false
            continue
        }

        if (char === '"') {
            inString = true
            out += char
            continue
        }

        if (!/\s/.test(char)) {
            out += char
            continue
        }

        const start = index
        while (index + 1 < source.length && /\s/.test(source[index + 1])) index += 1
        const whitespace = source.slice(start, index + 1)
        const previous = findLastSignificantChar(out)
        const next = findNextSignificantChar(source, index + 1)

        if (shouldInsertImplicitComma(previous, next)) out += ','
        out += whitespace
    }

    return out
}

function removeTrailingCommas(source: string) {
    let out = ''
    let inString = false
    let escaped = false

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index]

        if (inString) {
            out += char
            if (escaped) {
                escaped = false
                continue
            }
            if (char === '\\') {
                escaped = true
                continue
            }
            if (char === '"') inString = false
            continue
        }

        if (char === '"') {
            inString = true
            out += char
            continue
        }

        if (char === ',') {
            const next = findNextSignificantChar(source, index + 1)
            if (next === '}' || next === ']') continue
        }

        out += char
    }

    return out
}

function findLastSignificantChar(source: string) {
    for (let index = source.length - 1; index >= 0; index -= 1) {
        const char = source[index]
        if (!/\s/.test(char)) return char
    }
    return ''
}

function findNextSignificantChar(source: string, start: number) {
    for (let index = start; index < source.length; index += 1) {
        const char = source[index]
        if (!/\s/.test(char)) return char
    }
    return ''
}

function shouldInsertImplicitComma(previous: string, next: string) {
    return isJsonValueEnd(previous) && isJsonValueStart(next)
}

function isJsonValueEnd(char: string) {
    return JSON_VALUE_END_CHARS.has(char) || /\d/.test(char)
}

function isJsonValueStart(char: string) {
    return JSON_VALUE_START_CHARS.has(char) || /\d/.test(char)
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
