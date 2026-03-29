import type { Attachment, TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'

export const PUBLISH_SIGNATURE_KEY = '__zephyrPublish.signature'
export const PUBLISH_REMOTE_KEY = '__zephyrPublish.remoteKey'
export const PUBLISH_AT_KEY = '__zephyrPublish.publishedAt'

export function resolveZephyrExternalId(test: Pick<TestCase, 'links' | 'meta'>): string | undefined {
    const link = test.links?.find((item) => item.provider === 'zephyr')?.externalId
    const fromLink = safeString(link)
    if (fromLink) return fromLink
    return safeString(test.meta?.params?.key ?? test.meta?.params?.[PUBLISH_REMOTE_KEY])
}

export function buildPublishSignature(payload: ProviderTest): string {
    return JSON.stringify({
        name: payload.name,
        description: payload.description ?? '',
        steps: payload.steps.map((step) => ({
            action: step.action ?? '',
            data: step.data ?? '',
            expected: step.expected ?? '',
            attachments: (step.attachments ?? []).map((attachment) => ({
                name: attachment.name,
                pathOrDataUrl: attachment.pathOrDataUrl,
            })),
        })),
        attachments: (payload.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            pathOrDataUrl: attachment.pathOrDataUrl,
        })),
        objective: safeString(payload.extras?.objective) ?? '',
        preconditions: safeString(payload.extras?.preconditions) ?? '',
        folder: safeString(payload.extras?.folder) ?? '',
        labels: normalizeLabels(payload.extras?.labels),
        customFields: normalizeStructuredValue(payload.extras?.customFields),
        parameters: normalizeStructuredValue(payload.extras?.parameters),
    })
}

export function normalizeLabels(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean).sort((left, right) => left.localeCompare(right))
        : []
}

export function normalizeStructuredValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => normalizeStructuredValue(item))
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, normalizeStructuredValue(entry)])
        )
    }
    return value
}

export function summarizeStructuredValue(value: unknown, emptyLabel: string): string {
    const normalized = normalizeStructuredValue(value)
    if (normalized == null) return emptyLabel
    if (Array.isArray(normalized) && normalized.length === 0) return emptyLabel
    if (typeof normalized === 'object' && Object.keys(normalized).length === 0) return emptyLabel
    return JSON.stringify(normalized)
}

export function summarizeText(value: string | undefined, limit = 120): string {
    const text = String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return ''
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

export function safeString(value: unknown): string | undefined {
    const next = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    return next || undefined
}

export function copyAttachment(attachment: Attachment): Attachment {
    return {
        id: attachment.id,
        name: attachment.name,
        pathOrDataUrl: attachment.pathOrDataUrl,
    }
}
