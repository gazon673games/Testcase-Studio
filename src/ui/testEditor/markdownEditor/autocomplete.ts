import type { RefShared, RefStep, RefTest } from './types'

export type AutoStage = 'owner' | 'step' | 'field' | 'part'

export type AutoItem = {
    label: string
    detail?: string
    insert: string
    stage: AutoStage
    continues?: boolean
    muted?: boolean
}

type OwnerMatch = {
    owner: RefTest | RefShared
    prefix: 'id' | 'shared'
}

function buildCompositeFieldText(step: RefStep, kind: 'action' | 'data' | 'expected'): string {
    const topLevel = String(
        kind === 'action'
            ? step.action ?? step.text ?? ''
            : kind === 'data'
                ? step.data ?? ''
                : step.expected ?? ''
    ).trim()
    const blocks = (step.internal?.parts?.[kind] ?? []).map((part) => String(part.text ?? '').trim()).filter(Boolean)
    return [topLevel, ...blocks].filter(Boolean).join('\n').trim()
}

function getStepBody(
    step: RefStep,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
) {
    return resolveDisplayText(buildCompositeFieldText(step, 'action') || step.data || step.expected || '')
}

function getStepKinds(
    step: RefStep,
    t: (key: string, params?: Record<string, string | number>) => string,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): Array<{ kind: 'action' | 'data' | 'expected'; label: string; text: string }> {
    return [
        { kind: 'action', label: t('steps.action'), text: resolveDisplayText(buildCompositeFieldText(step, 'action')) },
        { kind: 'data', label: t('steps.data'), text: resolveDisplayText(buildCompositeFieldText(step, 'data')) },
        { kind: 'expected', label: t('steps.expected'), text: resolveDisplayText(buildCompositeFieldText(step, 'expected')) },
    ]
}

export function toPreviewishPlainText(value: string): string {
    return String(value ?? '')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_full, alt: string, src: string) => alt || src || '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function trimText(src: string, limit = 60) {
    const text = toPreviewishPlainText(String(src ?? ''))
    if (text.length <= limit) return text
    if (limit <= 3) return text.slice(0, limit)
    return `${text.slice(0, limit - 3)}...`
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

export function makeOwnerSuggestions(
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
            detail: test.id,
            insert: `id:${test.id}#`,
            stage: 'owner' as const,
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
            detail: item.id,
            insert: `shared:${item.id}#`,
            stage: 'owner' as const,
            continues: true,
        }))

    return [...tests, ...shared]
}

export function makeStepSuggestions(
    ownerQuery: string,
    stepFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string,
    resolveDisplayText: (value: string | undefined) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, allTests, sharedSteps)
    if (!ownerMatch) return []

    const { owner, prefix } = ownerMatch
    const filter = stepFilter.toLowerCase()

    return owner.steps
        .map((step, index) => {
            const idx = index + 1
            const displayBody = getStepBody(step, resolveDisplayText)
            const rawBody = step.action || step.text || step.data || step.expected || ''
            const hay = `${idx} ${String(step.id ?? '').toLowerCase()} ${rawBody.toLowerCase()} ${displayBody.toLowerCase()}`
            if (filter && !hay.includes(filter)) return null
            return {
                label: `#${idx}`,
                detail: displayBody || t('steps.stepNumber', { index: idx }),
                insert: `${prefix}:${owner.id}#${step.id ?? idx}.`,
                stage: 'step' as const,
                continues: true,
            }
        })
        .filter((item): item is AutoItem => Boolean(item))
        .slice(0, 20)
}

export function makeFieldSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string,
    resolveDisplayText: (value: string | undefined) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, allTests, sharedSteps)
    if (!ownerMatch) return []

    const stepMatch = findStepMatch(ownerMatch.owner, stepToken)
    if (!stepMatch) return []

    const filter = fieldFilter.toLowerCase()
    return getStepKinds(stepMatch.step, t, resolveDisplayText)
        .map((variant) => {
            const parts = stepMatch.step.internal?.parts?.[variant.kind] ?? []
            const detail = variant.text || t('markdown.emptyValue')
            const hay = `${variant.kind} ${variant.label} ${detail}`.toLowerCase()
            if (filter && !hay.includes(filter)) return null
            return {
                label: variant.label,
                detail,
                insert: `${ownerMatch.prefix}:${ownerMatch.owner.id}#${stepMatch.step.id ?? stepMatch.index + 1}.${variant.kind}${parts.length > 0 ? '@' : ''}`,
                stage: 'field' as const,
                continues: parts.length > 0,
                muted: !variant.text,
            }
        })
        .filter((item): item is AutoItem => Boolean(item))
        .slice(0, 6)
}

export function makePartSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldToken: string,
    partFilter: string,
    allTests: RefTest[],
    sharedSteps: RefShared[],
    t: (key: string, params?: Record<string, string | number>) => string,
    resolveDisplayText: (value: string | undefined) => string
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
    const fieldText = getStepKinds(stepMatch.step, t, resolveDisplayText).find((item) => item.kind === kind)?.text ?? ''
    const items: AutoItem[] = []
    const wholeFieldDetail = fieldText || t('markdown.emptyValue')

    if (!filter || `${t('markdown.wholeField')} ${kind} ${wholeFieldDetail}`.toLowerCase().includes(filter)) {
        items.push({
            label: t('markdown.wholeField'),
            detail: wholeFieldDetail,
            insert: baseInsert,
            stage: 'part',
            muted: !fieldText,
        })
    }

    parts.forEach((part, partIndex) => {
        const displayText = resolveDisplayText(part.text ?? '')
        const hay = `${kind} part ${partIndex + 1} ${part.text ?? ''} ${displayText}`.toLowerCase()
        if (filter && !hay.includes(filter)) return
        items.push({
            label: `#${partIndex + 1}`,
            detail: displayText || t('markdown.emptyValue'),
            insert: `${baseInsert}@${part.id ?? partIndex + 1}`,
            stage: 'part',
            muted: !displayText,
        })
    })

    return items.slice(0, 20)
}
