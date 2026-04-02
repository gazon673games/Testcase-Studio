import { isManagedAttachmentRef } from '@core/attachments'

export function isDirectAttachmentHref(value: string | undefined | null) {
    const raw = String(value ?? '')
    if (!raw) return false
    if (isManagedAttachmentRef(raw)) return false
    if (/^(https?:|mailto:|data:|blob:|file:)/i.test(raw)) return true
    return false
}
