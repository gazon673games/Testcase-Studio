import * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'
import './MarkdownEditor.css'
import { useUiPreferences } from '../../preferences'

export type RefPart = { id?: string; text?: string }
export type RefStep = {
    id?: string
    action?: string
    data?: string
    expected?: string
    text?: string
    internal?: {
        parts?: {
            action?: RefPart[]
            data?: RefPart[]
            expected?: RefPart[]
        }
    }
}

export type RefTest = {
    id: string
    name: string
    steps: RefStep[]
}

export type RefShared = {
    id: string
    name: string
    steps: RefStep[]
}

export type MarkdownEditorApi = {
    wrap(before: string, after: string): void
    insertPrefix(prefix: string): void
    insertText(text: string): void
    focus(): void
}

export type MarkdownEditorProps = {
    value: string
    onChange(v: string): void
    placeholder?: string
    rows?: number
    preview?: boolean
    editInPreview?: boolean
    onTogglePreview?: () => void
    resolveRefs?: (src: string) => string
    inspectRefs?: (src: string) => ResolvedWikiRef[]
    onOpenRef?: (ref: ResolvedWikiRef) => void
    allTests?: RefTest[]
    sharedSteps?: RefShared[]
    apiRef?: React.MutableRefObject<MarkdownEditorApi | null>
    onActivateApi?: (api: MarkdownEditorApi | null) => void
    hideToolbar?: boolean
    className?: string
}

type CaretAnchor = { top: number; left: number; bottom: number }

function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function mdToHtml(src: string): string {
    const lines = src.split('\n')
    const out: string[] = []
    let inUl = false
    let inOl = false

    const flush = () => {
        if (inUl) {
            out.push('</ul>')
            inUl = false
        }
        if (inOl) {
            out.push('</ol>')
            inOl = false
        }
    }

    for (let line of lines) {
        const trimmed = line.trim()
        if (/^-\s+/.test(trimmed)) {
            if (!inUl) {
                flush()
                out.push('<ul style="margin:0 0 0 20px; padding:0">')
                inUl = true
            }
            line = trimmed.replace(/^-+\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOl) {
                flush()
                out.push('<ol style="margin:0 0 0 20px; padding:0">')
                inOl = true
            }
            line = trimmed.replace(/^\d+\.\s+/, '')
            out.push(`<li>${inlineMd(line)}</li>`)
            continue
        }
        flush()
        if (!trimmed.length) {
            out.push('<br/>')
            continue
        }
        out.push(`<div>${inlineMd(line)}</div>`)
    }

    flush()
    return out.join('')
}

function inlineMd(src: string): string {
    let html = escapeHtml(src)
    html = html.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>')
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<u>$1</u>')
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%; vertical-align:middle;" />')
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    return html
}

function normalizeImageWikiRefs(src: string, resolveRefs?: (s: string) => string) {
    return src.replace(/!\[\[([^[\]]+)\]\]/g, (match, body: string) => {
        const inside = `[[${String(body).trim()}]]`
        const resolved = resolveRefs ? resolveRefs(inside) : inside
        if (!resolved || resolved.startsWith('[[')) return match
        return `![](${resolved})`
    })
}

const ALLOW_TAGS = new Set([
    'strong', 'b', 'em', 'i', 'u', 'code', 'pre', 'br', 'p', 'div', 'span',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'hr',
])
const ALLOW_ATTR: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    img: new Set(['src', 'alt', 'title']),
    span: new Set(['style']),
}
const URL_ATTR = new Set(['href', 'src'])

function isSafeUrl(value: string) {
    try {
        const parsed = new URL(value, 'http://x/')
        const protocol = parsed.protocol.toLowerCase()
        return protocol === 'http:' || protocol === 'https:' || value.startsWith('data:image/')
    } catch {
        return false
    }
}

function pickSafeStyle(tag: string, style: string | null): string | null {
    if (!style || tag !== 'span') return null
    const declarations = style.split(';').map((item) => item.trim()).filter(Boolean)
    let colorValue: string | null = null

    for (const declaration of declarations) {
        const [rawProp, ...rest] = declaration.split(':')
        if (!rawProp || !rest.length) continue
        const prop = rawProp.trim().toLowerCase()
        const value = rest.join(':').trim()
        if (prop !== 'color') continue

        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
        const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*(0|0?\.\d+|1(\.0)?))?\s*\)$/i
        if (hex.test(value) || rgb.test(value)) colorValue = value
    }

    return colorValue ? `color: ${colorValue}` : null
}

function sanitizeHtml(html: string): string {
    if (typeof html !== 'string') return ''
    const container = document.createElement('div')
    container.innerHTML = html

    const blacklist = new Set(['script', 'style'])
    const walk = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            const tag = element.tagName.toLowerCase()
            if (blacklist.has(tag)) {
                element.remove()
                return
            }

            if (!ALLOW_TAGS.has(tag)) {
                const parent = element.parentNode
                if (parent) {
                    while (element.firstChild) parent.insertBefore(element.firstChild, element)
                    parent.removeChild(element)
                }
            } else {
                for (const attr of Array.from(element.attributes)) {
                    const name = attr.name.toLowerCase()
                    if (name.startsWith('on')) {
                        element.removeAttribute(attr.name)
                        continue
                    }
                    if (URL_ATTR.has(name) && !isSafeUrl(attr.value)) {
                        element.removeAttribute(attr.name)
                        continue
                    }
                    if (name === 'style') {
                        const safeStyle = pickSafeStyle(tag, element.getAttribute('style'))
                        if (safeStyle) element.setAttribute('style', safeStyle)
                        else element.removeAttribute('style')
                        continue
                    }
                    const allowForTag = ALLOW_ATTR[tag]
                    if (allowForTag) {
                        if (!allowForTag.has(name)) element.removeAttribute(attr.name)
                    } else if (name !== 'title') {
                        element.removeAttribute(attr.name)
                    }
                }
            }
        }

        for (const child of Array.from(node.childNodes)) walk(child)
    }

    walk(container)
    for (const link of Array.from(container.querySelectorAll('a'))) {
        link.setAttribute('rel', 'noopener noreferrer')
        if (!link.getAttribute('target')) link.setAttribute('target', '_blank')
    }

    return container.innerHTML
}

function looksLikeHtml(src: string) {
    return /<\s*(strong|b|em|i|u|code|pre|br|p|div|span|ol|ul|li|h[1-6]|a|img)\b/i.test(src)
}

function getCaretAnchor(el: HTMLTextAreaElement): CaretAnchor | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null

    const rect = el.getBoundingClientRect()
    const styles = window.getComputedStyle(el)
    const mirror = document.createElement('div')
    const marker = document.createElement('span')
    const caret = el.selectionStart ?? 0

    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.pointerEvents = 'none'
    mirror.style.boxSizing = styles.boxSizing
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordBreak = 'break-word'
    mirror.style.overflowWrap = 'anywhere'
    mirror.style.width = `${rect.width}px`
    mirror.style.left = `${rect.left + window.scrollX}px`
    mirror.style.top = `${rect.top + window.scrollY}px`
    mirror.style.padding = styles.padding
    mirror.style.border = styles.border
    mirror.style.font = styles.font
    mirror.style.fontFamily = styles.fontFamily
    mirror.style.fontSize = styles.fontSize
    mirror.style.fontStyle = styles.fontStyle
    mirror.style.fontWeight = styles.fontWeight
    mirror.style.letterSpacing = styles.letterSpacing
    mirror.style.lineHeight = styles.lineHeight
    mirror.style.textAlign = styles.textAlign
    mirror.style.textTransform = styles.textTransform
    mirror.style.textIndent = styles.textIndent
    mirror.style.tabSize = styles.tabSize

    mirror.textContent = el.value.slice(0, caret)
    marker.textContent = el.value.slice(caret, caret + 1) || '\u200b'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const markerRect = marker.getBoundingClientRect()
    document.body.removeChild(mirror)

    const height = markerRect.height || parseFloat(styles.lineHeight) || 18
    const top = markerRect.top + window.scrollY - el.scrollTop
    const left = markerRect.left + window.scrollX - el.scrollLeft
    return { top, left, bottom: top + height }
}

function trimText(src: string, limit = 60) {
    const text = String(src ?? '').replace(/\s+/g, ' ').trim()
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

type AutoStage = 'owner' | 'step' | 'field' | 'part'
type AutoItem = {
    label: string
    insert: string
    stage: AutoStage
    continues?: boolean
}

type OwnerMatch = {
    owner: RefTest | RefShared
    prefix: 'id' | 'shared'
}

function getStepBody(step: RefStep) {
    return step.action || step.text || step.data || step.expected || ''
}

function getStepKinds(
    step: RefStep,
    t: (key: string, params?: Record<string, string | number>) => string
): Array<{ kind: 'action' | 'data' | 'expected'; label: string; text: string }> {
    return [
        { kind: 'action', label: t('steps.action'), text: step.action || step.text || '' },
        { kind: 'data', label: t('steps.data'), text: step.data || '' },
        { kind: 'expected', label: t('steps.expected'), text: step.expected || '' },
    ]
}

function findOwnerMatch(ownerQuery: string, allTests: RefTest[], sharedSteps: RefShared[]): OwnerMatch | null {
    const lowerOwner = ownerQuery.trim().toLowerCase()
    if (!lowerOwner) return null

    if (lowerOwner.startsWith('shared:')) {
        const token = lowerOwner.slice(7).trim()
        const owner = sharedSteps.find((item) =>
            item.id.toLowerCase().startsWith(token) || item.name.toLowerCase().startsWith(token)
        )
        return owner ? { owner, prefix: 'shared' } : null
    }

    if (lowerOwner.startsWith('id:')) {
        const token = lowerOwner.slice(3).trim()
        const owner = allTests.find((test) =>
            test.id.toLowerCase().startsWith(token) || test.name.toLowerCase().startsWith(token)
        )
        return owner ? { owner, prefix: 'id' } : null
    }

    const testOwner = allTests.find((test) => test.name.toLowerCase().startsWith(lowerOwner))
    if (testOwner) return { owner: testOwner, prefix: 'id' }

    const sharedOwner = sharedSteps.find((item) => item.name.toLowerCase().startsWith(lowerOwner))
    return sharedOwner ? { owner: sharedOwner, prefix: 'shared' } : null
}

function findStepMatch(owner: RefTest | RefShared, stepToken: string): { step: RefStep; index: number } | null {
    const token = stepToken.trim().toLowerCase()
    if (!token) return null

    const numeric = Number(token)
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= owner.steps.length) {
        return { step: owner.steps[numeric - 1], index: numeric - 1 }
    }

    const indexMatch = owner.steps.findIndex((step, index) => {
        const idx = String(index + 1)
        const hay = `${idx} ${String(step.id ?? '').toLowerCase()} ${getStepBody(step).toLowerCase()}`
        return hay.includes(token)
    })

    return indexMatch === -1 ? null : { step: owner.steps[indexMatch], index: indexMatch }
}

function makeOwnerSuggestions(
    allTests: RefTest[],
    sharedSteps: RefShared[],
    query: string,
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const lower = query.toLowerCase()
    const idQuery = lower.startsWith('id:') ? query.slice(3).trim().toLowerCase() : ''
    const sharedQuery = lower.startsWith('shared:') ? query.slice(7).trim().toLowerCase() : ''

    const tests = allTests
        .filter((test) => {
            if (!lower) return true
            if (idQuery) return test.id.toLowerCase().startsWith(idQuery)
            return test.name.toLowerCase().includes(lower)
        })
        .slice(0, 10)
        .map((test) => ({
            label: t('markdown.testLabel', { name: test.name }),
            insert: `id:${test.id}#`,
            stage: 'owner',
            continues: true,
        }))

    const shared = sharedSteps
        .filter((item) => {
            if (!lower) return true
            if (sharedQuery) return item.id.toLowerCase().startsWith(sharedQuery)
            return item.name.toLowerCase().includes(lower)
        })
        .slice(0, 10)
        .map((item) => ({
            label: t('markdown.sharedLabel', { name: item.name }),
            insert: `shared:${item.id}#`,
            stage: 'owner',
            continues: true,
        }))

    return [...tests, ...shared]
}

function makeStepSuggestions(
    ownerQuery: string,
    stepFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, allTests, sharedSteps)
    if (!ownerMatch) return []

    const { owner, prefix } = ownerMatch
    const filter = stepFilter.toLowerCase()

    return owner.steps
        .map((step, index) => {
            const idx = index + 1
            const hay = `${idx} ${String(step.id ?? '').toLowerCase()} ${getStepBody(step).toLowerCase()}`
            if (filter && !hay.includes(filter)) return null
            return {
                label: `#${idx} - ${trimText(getStepBody(step) || t('steps.stepNumber', { index: idx }))}`,
                insert: `${prefix}:${owner.id}#${step.id ?? idx}.`,
                stage: 'step' as const,
                continues: true,
            }
        })
        .filter((item): item is AutoItem => Boolean(item))
        .slice(0, 20)
}

function makeFieldSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, allTests, sharedSteps)
    if (!ownerMatch) return []

    const stepMatch = findStepMatch(ownerMatch.owner, stepToken)
    if (!stepMatch) return []

    const filter = fieldFilter.toLowerCase()
    return getStepKinds(stepMatch.step, t)
        .map((variant) => {
            const parts = stepMatch.step.internal?.parts?.[variant.kind] ?? []
            const hay = `${variant.kind} ${variant.label} ${variant.text}`.toLowerCase()
            if (filter && !hay.includes(filter)) return null
            return {
                label: `${variant.label} - ${trimText(variant.text || getStepBody(stepMatch.step) || variant.label)}`,
                insert: `${ownerMatch.prefix}:${ownerMatch.owner.id}#${stepMatch.step.id ?? stepMatch.index + 1}.${variant.kind}${parts.length > 0 ? '@' : ''}`,
                stage: 'field' as const,
                continues: parts.length > 0,
            }
        })
        .filter((item): item is AutoItem => Boolean(item))
        .slice(0, 6)
}

function makePartSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldToken: string,
    partFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, allTests, sharedSteps)
    if (!ownerMatch) return []

    const stepMatch = findStepMatch(ownerMatch.owner, stepToken)
    if (!stepMatch) return []

    const normalizedField = fieldToken.trim().toLowerCase()
    if (!['action', 'data', 'expected'].includes(normalizedField)) return []
    const kind = normalizedField as 'action' | 'data' | 'expected'
    const parts = stepMatch.step.internal?.parts?.[kind] ?? []
    const filter = partFilter.toLowerCase()
    const baseInsert = `${ownerMatch.prefix}:${ownerMatch.owner.id}#${stepMatch.step.id ?? stepMatch.index + 1}.${kind}`
    const fieldText = getStepKinds(stepMatch.step, t).find((item) => item.kind === kind)?.text ?? ''
    const items: AutoItem[] = []

    if (!filter || `${t('markdown.wholeField')} ${kind} ${fieldText}`.toLowerCase().includes(filter)) {
        items.push({
            label: `${t('markdown.wholeField')} - ${trimText(fieldText)}`,
            insert: baseInsert,
            stage: 'part',
        })
    }

    parts.forEach((part, partIndex) => {
        const hay = `${kind} part ${partIndex + 1} ${part.text ?? ''}`.toLowerCase()
        if (filter && !hay.includes(filter)) return
        items.push({
            label: `#${partIndex + 1} - ${trimText(part.text ?? '')}`,
            insert: `${baseInsert}@${part.id ?? partIndex + 1}`,
            stage: 'part',
        })
    })

    return items.slice(0, 20)
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const { t } = useUiPreferences()
    const {
        value,
        onChange,
        placeholder,
        rows = 3,
        preview = false,
        editInPreview = false,
        onTogglePreview,
        resolveRefs,
        inspectRefs,
        onOpenRef,
        allTests = [],
        sharedSteps = [],
        apiRef,
        onActivateApi,
        hideToolbar = false,
        className = '',
    } = props

    const taRef = React.useRef<HTMLTextAreaElement | null>(null)
    const previewRef = React.useRef<HTMLDivElement | null>(null)
    const measurerRef = React.useRef<HTMLDivElement | null>(null)
    const [active, setActive] = React.useState(false)
    const [hoveredRef, setHoveredRef] = React.useState<ResolvedWikiRef | null>(null)

    const doWrap = React.useCallback((before: string, after: string) => {
        const el = taRef.current
        if (!el) return
        const start = Math.min(el.selectionStart, el.selectionEnd)
        const end = Math.max(el.selectionStart, el.selectionEnd)
        const left = value.slice(0, start)
        const mid = value.slice(start, end)
        const right = value.slice(end)
        onChange(left + before + mid + after + right)
        requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = start + before.length + mid.length + after.length
            el.focus()
        })
    }, [onChange, value])

    const doInsertPrefix = React.useCallback((prefix: string) => {
        const el = taRef.current
        if (!el) return
        const lines = value.split('\n')
        const start = el.selectionStart
        const end = el.selectionEnd
        let startLine = 0
        let endLine = lines.length - 1

        for (let index = 0, acc = 0; index < lines.length; index += 1, acc += lines[index].length + 1) {
            if (acc + lines[index].length >= start) {
                startLine = index
                break
            }
        }

        for (let index = startLine; index < lines.length; index += 1) {
            const lineStart = lines.slice(0, index).join('\n').length + (index ? 1 : 0)
            const lineEnd = lineStart + lines[index].length
            if (lineEnd >= end) {
                endLine = index
                break
            }
        }

        for (let index = startLine; index <= endLine; index += 1) {
            lines[index] = lines[index].length ? `${prefix} ${lines[index]}` : `${prefix} `
        }
        onChange(lines.join('\n'))
        requestAnimationFrame(() => el.focus())
    }, [onChange, value])

    const doInsertText = React.useCallback((text: string) => {
        const el = taRef.current
        if (!el) return
        const start = Math.min(el.selectionStart, el.selectionEnd)
        const end = Math.max(el.selectionStart, el.selectionEnd)
        const left = value.slice(0, start)
        const right = value.slice(end)
        const nextValue = `${left}${text}${right}`
        onChange(nextValue)
        requestAnimationFrame(() => {
            const pos = left.length + text.length
            el.focus()
            el.selectionStart = el.selectionEnd = pos
        })
    }, [onChange, value])

    const editorApi = React.useMemo<MarkdownEditorApi>(() => ({
        wrap: doWrap,
        insertPrefix: doInsertPrefix,
        insertText: doInsertText,
        focus: () => taRef.current?.focus(),
    }), [doInsertPrefix, doInsertText, doWrap])

    React.useEffect(() => {
        if (apiRef) apiRef.current = editorApi
        return () => {
            if (apiRef?.current === editorApi) apiRef.current = null
        }
    }, [apiRef, editorApi])

    React.useEffect(() => {
        if (active && onActivateApi) onActivateApi(editorApi)
    }, [active, editorApi, onActivateApi])

    const renderPreviewHtml = React.useCallback((input: string) => {
        const resolved = typeof resolveRefs === 'function' ? resolveRefs(input ?? '') : (input ?? '')
        return looksLikeHtml(resolved)
            ? sanitizeHtml(resolved)
            : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))
    }, [resolveRefs])

    const syncHeights = React.useCallback(() => {
        const textarea = taRef.current
        if (!textarea) return

        const measurer = measurerRef.current
        if (measurer) measurer.offsetHeight
        const targetHeight = measurer?.scrollHeight ?? previewRef.current?.scrollHeight ?? textarea.scrollHeight

        textarea.style.height = 'auto'
        textarea.style.overflow = 'hidden'
        textarea.style.height = `${targetHeight}px`

        if (previewRef.current) {
            previewRef.current.style.height = `${targetHeight}px`
            previewRef.current.style.overflow = 'auto'
        }
    }, [])

    React.useLayoutEffect(() => {
        syncHeights()
    }, [preview, syncHeights, value])

    React.useEffect(() => {
        const onResize = () => syncHeights()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [syncHeights])

    React.useEffect(() => {
        if (!preview) return
        taRef.current?.blur()
        setAcOpen(false)
    }, [preview])

    const [acOpen, setAcOpen] = React.useState(false)
    const [acItems, setAcItems] = React.useState<AutoItem[]>([])
    const [acIndex, setAcIndex] = React.useState(0)
    const [acStage, setAcStage] = React.useState<AutoStage>('owner')
    const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
    const [range, setRange] = React.useState<{ from: number; to: number } | null>(null)

    const updateSuggestions = React.useCallback((el: HTMLTextAreaElement, text = value, caretOverride?: number) => {
        const caret = caretOverride ?? el.selectionStart
        const before = text.slice(0, caret)
        const start = before.lastIndexOf('[[')
        const close = before.lastIndexOf(']]')
        if (start === -1 || (close !== -1 && close > start)) {
            setAcOpen(false)
            setRange(null)
            return
        }

        const query = before.slice(start + 2)
        const caretAnchor = getCaretAnchor(el)
        const menuWidth = 380
        const menuHeight = 260
        const gutter = 12
        const fallbackRect = el.getBoundingClientRect()
        const minLeft = window.scrollX + gutter
        const maxLeft = Math.max(minLeft, window.scrollX + window.innerWidth - menuWidth - gutter)
        const left = caretAnchor
            ? Math.max(minLeft, Math.min(caretAnchor.left, maxLeft))
            : fallbackRect.left + window.scrollX + 8
        const top = caretAnchor
            ? (
                caretAnchor.bottom + menuHeight + gutter <= window.scrollY + window.innerHeight
                    ? caretAnchor.bottom + 6
                    : Math.max(window.scrollY + gutter, caretAnchor.top - menuHeight - 6)
            )
            : fallbackRect.bottom + window.scrollY

        setAnchor({ top, left })
        setRange({ from: start, to: caret })

        const hashPos = query.indexOf('#')
        let stage: AutoStage = 'owner'
        let items: AutoItem[] = []

        if (hashPos === -1) {
            stage = 'owner'
            items = makeOwnerSuggestions(allTests, sharedSteps, query.trim(), t)
        } else {
            const ownerQuery = query.slice(0, hashPos).trim()
            const afterHash = query.slice(hashPos + 1)
            const dotPos = afterHash.indexOf('.')
            const atPos = afterHash.indexOf('@')

            if (dotPos === -1) {
                stage = 'step'
                items = makeStepSuggestions(ownerQuery, afterHash.trim(), allTests, sharedSteps, t)
            } else if (atPos === -1) {
                stage = 'field'
                items = makeFieldSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1).trim(),
                    allTests,
                    sharedSteps,
                    t
                )
            } else {
                stage = 'part'
                items = makePartSuggestions(
                    ownerQuery,
                    afterHash.slice(0, dotPos).trim(),
                    afterHash.slice(dotPos + 1, atPos).trim(),
                    afterHash.slice(atPos + 1).trim(),
                    allTests,
                    sharedSteps,
                    t
                )
            }
        }

        setAcStage(stage)
        setAcItems(items)
        setAcIndex(0)
        setAcOpen(items.length > 0)
    }, [allTests, sharedSteps, t, value])

    function applySuggestion(item: AutoItem) {
        const el = taRef.current
        if (!el || !range) return
        const left = value.slice(0, range.from)
        const continueSelection = Boolean(item.continues)
        const right = value.slice(range.to).replace(/^\]\]+/, '')
        const nextValue = `${left}[[${item.insert}]]${right}`
        onChange(nextValue)
        requestAnimationFrame(() => {
            el.focus()
            const pos = continueSelection
                ? left.length + 2 + item.insert.length
                : (left + '[[' + item.insert + ']]').length
            el.selectionStart = el.selectionEnd = pos
            if (continueSelection) {
                updateSuggestions(el, nextValue, pos)
            } else {
                setAcOpen(false)
            }
        })
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!acOpen) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAcIndex((current) => Math.min(current + 1, acItems.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAcIndex((current) => Math.max(current - 1, 0))
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            const item = acItems[acIndex]
            if (item) applySuggestion(item)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setAcOpen(false)
        }
    }

    function onChangeWrapped(e: React.ChangeEvent<HTMLTextAreaElement>) {
        onChange(e.target.value)
        updateSuggestions(e.target, e.target.value)
    }

    function onCursorActivity() {
        const el = taRef.current
        if (el) updateSuggestions(el)
    }

    function onKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (acOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return
        onCursorActivity()
    }

    const refs = React.useMemo(() => (inspectRefs ? inspectRefs(value) : []), [inspectRefs, value])
    const previewHtml = React.useMemo(() => renderPreviewHtml(value), [renderPreviewHtml, value])

    const toolbar = !hideToolbar && active && !preview ? (
        <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
            <button type="button" className="md-btn" title="Bold" onClick={() => doWrap('**', '**')}>B</button>
            <button type="button" className="md-btn" title="Italic" onClick={() => doWrap('*', '*')}><i>I</i></button>
            <button type="button" className="md-btn" title="Underline" onClick={() => doWrap('__', '__')}><u>U</u></button>
            <div className="divider" />
            <button type="button" className="md-btn" title="Bulleted list" onClick={() => doInsertPrefix('-')}>*</button>
            <button type="button" className="md-btn" title="Numbered list" onClick={() => doInsertPrefix('1.')}>1.</button>
            <div className="divider" />
            <button type="button" className="md-btn" title="Code" onClick={() => doWrap('`', '`')}>{'</>'}</button>
            <button type="button" className="md-btn" title="Link" onClick={() => doWrap('[', '](url)')}>Link</button>
            <button type="button" className="md-btn" title="Image" onClick={() => doWrap('![', '](image.png)')}>Img</button>
            {typeof onTogglePreview === 'function' && (
                <>
                    <div className="divider" />
                    <button type="button" className="md-btn" title={t('markdown.togglePreview')} onClick={onTogglePreview}>
                        {t('markdown.togglePreview')}
                </button>
                </>
            )}
        </div>
    ) : null

    return (
        <div className={`md-editor ${preview ? 'is-preview' : ''} ${className}`}>
            {toolbar}
            <div className="md-input-wrap">
                <div
                    ref={measurerRef}
                    className="md-preview measurer"
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                />

                <textarea
                    ref={taRef}
                    value={value}
                    onChange={onChangeWrapped}
                    onKeyDown={onKeyDown}
                    onKeyUp={onKeyUp}
                    onClick={onCursorActivity}
                    onFocus={() => {
                        setActive(true)
                        onActivateApi?.(editorApi)
                        const el = taRef.current
                        if (el) updateSuggestions(el)
                    }}
                    onBlur={() => {
                        setActive(false)
                        onActivateApi?.(null)
                        setAcOpen(false)
                    }}
                    placeholder={placeholder}
                    rows={rows}
                    className={`md-textarea ${preview && editInPreview ? 'md-textarea--preview-edit' : ''}`}
                    wrap="soft"
                    aria-hidden={preview && !editInPreview}
                    tabIndex={preview && !editInPreview ? -1 : 0}
                />

                {preview && (
                    <div
                        ref={previewRef}
                        className={`md-preview ${editInPreview ? 'md-preview--editable' : ''}`}
                        tabIndex={editInPreview ? -1 : 0}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                )}

                {acOpen && anchor && (
                    <AutocompleteBox
                        top={anchor.top}
                        left={anchor.left}
                        stage={acStage}
                        stageLabel={t(`markdown.stage.${acStage}`)}
                        items={acItems}
                        index={acIndex}
                        onPick={applySuggestion}
                        onClose={() => setAcOpen(false)}
                    />
                )}
            </div>

            {refs.length > 0 && (
                <div className="md-ref-strip">
                    {refs.map((refInfo, index) => (
                        <button
                            key={`${refInfo.raw}-${index}`}
                            type="button"
                            className={`md-ref-pill ${refInfo.ok ? 'ok' : 'broken'}`}
                            onMouseEnter={() => setHoveredRef(refInfo)}
                            onMouseLeave={() => setHoveredRef((current) => (current?.raw === refInfo.raw ? null : current))}
                            onClick={() => {
                                if (refInfo.ok) onOpenRef?.(refInfo)
                            }}
                            title={refInfo.ok ? refInfo.preview : refInfo.brokenReason ?? t('steps.brokenLink')}
                        >
                            {refInfo.ok ? trimText(refInfo.label, 44) : `Broken: ${trimText(refInfo.body, 32)}`}
                        </button>
                    ))}
                    {hoveredRef && (
                        <div className={`md-ref-preview ${hoveredRef.ok ? 'ok' : 'broken'}`}>
                            <div className="md-ref-preview-title">{hoveredRef.ok ? hoveredRef.label : t('steps.brokenLink')}</div>
                            <div className="md-ref-preview-body">
                                {hoveredRef.ok ? hoveredRef.preview : hoveredRef.brokenReason ?? hoveredRef.raw}
                            </div>
                            {hoveredRef.ok && onOpenRef && (
                                <button
                                    type="button"
                                    className="md-ref-open"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => onOpenRef(hoveredRef)}
                                >
                                    Open source
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

type AutocompleteBoxProps = {
    top: number
    left: number
    stage: AutoStage
    stageLabel: string
    items: AutoItem[]
    index: number
    onPick(item: AutoItem): void
    onClose(): void
}

const AutocompleteBox: React.FC<AutocompleteBoxProps> = ({ top, left, stage, stageLabel, items, index, onPick, onClose }) => {
    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    React.useEffect(() => {
        const onScroll = () => onClose()
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [onClose])

    return (
        <div className="autocomplete" style={{ top, left }} role="listbox" aria-label={`Wiki references suggestions: ${stage}`}>
            <div className="autocomplete-stage">{stageLabel}</div>
            {items.length === 0 ? (
                <div className="autocomplete-empty">No matches</div>
            ) : (
                items.map((item, itemIndex) => (
                    <div
                        key={`${item.insert}-${itemIndex}`}
                        onMouseDown={(e) => {
                            e.preventDefault()
                            onPick(item)
                        }}
                        className={`autocomplete-item ${itemIndex === index ? 'active' : ''}`}
                        role="option"
                        aria-selected={itemIndex === index}
                        title={item.insert}
                    >
                        {item.label}
                    </div>
                ))
            )}
        </div>
    )
}

export default MarkdownEditor
