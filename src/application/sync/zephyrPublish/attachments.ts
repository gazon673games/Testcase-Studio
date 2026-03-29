import type { Attachment } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import { translate } from '@shared/i18n'
import { copyAttachment } from './common'

export function collectProviderAttachments(payload: ProviderTest): Attachment[] {
    const items = new Map<string, Attachment>()
    const push = (attachment: Attachment | undefined) => {
        if (!attachment) return
        const key = attachment.id || `${attachment.name}::${attachment.pathOrDataUrl}`
        if (!items.has(key)) items.set(key, copyAttachment(attachment))
    }

    ;(payload.attachments ?? []).forEach(push)
    ;(payload.steps ?? []).forEach((step) => (step.attachments ?? []).forEach(push))
    return [...items.values()]
}

export function buildAttachmentPlan(local: Attachment[], remote: Attachment[]) {
    const remoteBuckets = bucketAttachmentsByName(remote)
    const localBuckets = bucketAttachmentsByName(local)
    const uploads: Attachment[] = []
    const deleteIds: string[] = []

    for (const attachment of local) {
        const bucket = remoteBuckets.get(attachment.name) ?? []
        if (bucket.length) {
            bucket.shift()
            continue
        }
        uploads.push(copyAttachment(attachment))
    }

    for (const attachment of remote) {
        const bucket = localBuckets.get(attachment.name) ?? []
        if (bucket.length) {
            bucket.shift()
            continue
        }
        if (attachment.id) deleteIds.push(attachment.id)
    }

    return { uploads, deleteIds }
}

export function collectAttachmentWarnings(local: Attachment[], remote: Attachment[]): string[] {
    const t = translate
    const warnings: string[] = []
    const plan = buildAttachmentPlan(local, remote)
    if (plan.uploads.length) warnings.push(t('publish.warning.attachmentsUpload'))
    if (plan.deleteIds.length) warnings.push(t('publish.warning.attachmentsDelete'))
    return warnings
}

export function summarizeAttachments(payload: ProviderTest): string {
    const t = translate
    const attachments = collectProviderAttachments(payload)
    if (!attachments.length) return t('publish.summary.noAttachments')
    const head = attachments.slice(0, 3).map((attachment) => attachment.name).filter(Boolean)
    return t('publish.summary.attachments', {
        count: attachments.length,
        names: head.length ? ` - ${head.join(', ')}` : '',
    })
}

function bucketAttachmentsByName(attachments: Attachment[]) {
    const buckets = new Map<string, Attachment[]>()
    attachments.forEach((attachment) => {
        const bucket = buckets.get(attachment.name)
        if (bucket) bucket.push(attachment)
        else buckets.set(attachment.name, [attachment])
    })
    return buckets
}
