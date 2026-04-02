import { findOwnerMatch, findStepMatch, type AutocompleteIndex, type IndexedFieldKind } from './autocompleteIndex'

export type AutoStage = 'owner' | 'step' | 'field' | 'part'

export type AutoItem = {
    label: string
    detail?: string
    insert: string
    stage: AutoStage
    continues?: boolean
    muted?: boolean
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

export function makeOwnerSuggestions(
    index: AutocompleteIndex,
    query: string,
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const lower = query.toLowerCase()
    const idQuery = lower.startsWith('id:') ? query.slice(3).trim().toLowerCase() : ''
    const sharedQuery = lower.startsWith('shared:') ? query.slice(7).trim().toLowerCase() : ''

    const tests = index.tests
        .filter((owner) => {
            if (!lower) return true
            if (idQuery) return owner.idLower.startsWith(idQuery)
            return owner.nameLower.includes(lower)
        })
        .slice(0, 10)
        .map((owner) => ({
            label: t('markdown.testLabel', { name: owner.ownerName }),
            detail: owner.ownerId,
            insert: `id:${owner.ownerId}#`,
            stage: 'owner' as const,
            continues: true,
        }))

    const shared = index.shared
        .filter((owner) => {
            if (!lower) return true
            if (sharedQuery) return owner.idLower.startsWith(sharedQuery)
            return owner.nameLower.includes(lower)
        })
        .slice(0, 10)
        .map((owner) => ({
            label: t('markdown.sharedLabel', { name: owner.ownerName }),
            detail: owner.ownerId,
            insert: `shared:${owner.ownerId}#`,
            stage: 'owner' as const,
            continues: true,
        }))

    return [...tests, ...shared]
}

export function makeStepSuggestions(
    ownerQuery: string,
    stepFilter: string,
    index: AutocompleteIndex,
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, index)
    if (!ownerMatch) return []

    const filter = stepFilter.toLowerCase()

    return ownerMatch.steps
        .map<AutoItem | null>((step, index) => {
            const idx = index + 1
            if (filter && !step.searchHay.includes(filter)) return null
            return {
                label: `#${idx}`,
                detail: step.displayBody || t('steps.stepNumber', { index: idx }),
                insert: `${ownerMatch.prefix}:${ownerMatch.ownerId}#${step.step.id ?? idx}.`,
                stage: 'step' as const,
                continues: true,
            }
        })
        .filter((item): item is AutoItem => item !== null)
        .slice(0, 20)
}

export function makeFieldSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldFilter: string,
    index: AutocompleteIndex,
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, index)
    if (!ownerMatch) return []

    const stepMatch = findStepMatch(ownerMatch, stepToken)
    if (!stepMatch) return []

    const filter = fieldFilter.toLowerCase()
    return (['action', 'data', 'expected'] as IndexedFieldKind[])
        .map<AutoItem | null>((variant) => {
            const field = stepMatch.fields[variant]
            const label =
                variant === 'action'
                    ? t('steps.action')
                    : variant === 'data'
                        ? t('steps.data')
                        : t('steps.expected')
            const detail = field.text || t('markdown.emptyValue')
            const hay = `${variant} ${label} ${detail}`.toLowerCase()
            if (filter && !hay.includes(filter)) return null
            return {
                label,
                detail,
                insert: `${ownerMatch.prefix}:${ownerMatch.ownerId}#${stepMatch.step.id ?? stepMatch.index + 1}.${variant}${field.parts.length > 0 ? '@' : ''}`,
                stage: 'field' as const,
                continues: field.parts.length > 0,
                muted: !field.text,
            }
        })
        .filter((item): item is AutoItem => item !== null)
        .slice(0, 6)
}

export function makePartSuggestions(
    ownerQuery: string,
    stepToken: string,
    fieldToken: string,
    partFilter: string,
    index: AutocompleteIndex,
    t: (key: string, params?: Record<string, string | number>) => string
): AutoItem[] {
    const ownerMatch = findOwnerMatch(ownerQuery, index)
    if (!ownerMatch) return []

    const stepMatch = findStepMatch(ownerMatch, stepToken)
    if (!stepMatch) return []

    const normalizedField = fieldToken.trim().toLowerCase()
    if (!['action', 'data', 'expected'].includes(normalizedField)) return []
    const kind = normalizedField as IndexedFieldKind
    const field = stepMatch.fields[kind]
    const filter = partFilter.toLowerCase()
    const baseInsert = `${ownerMatch.prefix}:${ownerMatch.ownerId}#${stepMatch.step.id ?? stepMatch.index + 1}.${kind}`
    const fieldText = field.text
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

    field.parts.forEach((part) => {
        if (filter && !part.searchHay.includes(filter)) return
        items.push({
            label: `#${part.index + 1}`,
            detail: part.displayText || t('markdown.emptyValue'),
            insert: `${baseInsert}@${part.part.id ?? part.index + 1}`,
            stage: 'part',
            muted: !part.displayText,
        })
    })

    return items.slice(0, 20)
}
