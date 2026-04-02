import { mdToHtml, looksLikeHtml } from '../markdown'
import type { ResolvedWikiRef, ResolveRefsMode } from './refTypes'

export function formatResolvedRefLabel(
    ref: Pick<ResolvedWikiRef, 'ownerType' | 'ownerName' | 'preview' | 'raw'>,
    t: (key: 'refs.owner.shared' | 'refs.owner.test' | 'refs.stepFallback', params?: Record<string, string | number>) => string
): string {
    const ownerPrefix = ref.ownerType === 'shared' ? t('refs.owner.shared') : t('refs.owner.test')
    const stepTitle = trimPreview(ref.preview || '') || t('refs.stepFallback')
    return `${ownerPrefix}: ${ref.ownerName ?? ''} -> ${stepTitle}`
}

export function formatResolvedRefBrokenReason(
    ref: Pick<ResolvedWikiRef, 'brokenReasonCode' | 'brokenReason'>,
    t: (
        key:
            | 'refs.broken.sourceAmbiguous'
            | 'refs.broken.sourceMissing'
            | 'refs.broken.stepMissing'
            | 'refs.broken.partMissing'
            | 'refs.broken.fieldEmpty'
            | 'refs.broken.cycleDetected'
    ) => string
): string {
    switch (ref.brokenReasonCode) {
        case 'source-ambiguous':
            return t('refs.broken.sourceAmbiguous')
        case 'source-missing':
            return t('refs.broken.sourceMissing')
        case 'step-missing':
            return t('refs.broken.stepMissing')
        case 'part-missing':
            return t('refs.broken.partMissing')
        case 'field-empty':
            return t('refs.broken.fieldEmpty')
        case 'cycle-detected':
            return t('refs.broken.cycleDetected')
        default:
            return ref.brokenReason ?? t('refs.broken.sourceMissing')
    }
}

export function renderResolvedValue(ref: ResolvedWikiRef, mode: ResolveRefsMode): string {
    if (mode === 'plain' || !ref.image) return ref.preview
    return renderEmbeddedHtml(ref.preview)
}

function renderEmbeddedHtml(value: string): string {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return ''
    if (looksLikeHtml(trimmed)) return `<div class="tsh-ref-embed">${trimmed}</div>`
    if (looksLikeImageSource(trimmed)) {
        return `<figure class="tsh-ref-embed tsh-ref-embed--image"><img src="${escapeHtmlAttribute(trimmed)}" alt="" /></figure>`
    }
    return `<div class="tsh-ref-embed">${mdToHtml(trimmed)}</div>`
}

function looksLikeImageSource(value: string): boolean {
    if (!value) return false
    if (/^data:image\//i.test(value)) return true
    if (/^https?:\/\/\S+$/i.test(value)) return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i.test(value)
    return /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(value)
}

function escapeHtmlAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

export function trimPreview(value: string, limit = 180): string {
    const withoutTags = value.replace(/<[^>]+>/g, ' ')
    const normalized = withoutTags.replace(/\s+/g, ' ').trim()
    if (!normalized) return ''
    return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}
