export const MANAGED_ATTACHMENT_SCHEME = 'managed://'

export function isManagedAttachmentRef(value: string | undefined | null): boolean {
    return String(value ?? '').startsWith(MANAGED_ATTACHMENT_SCHEME)
}

export function buildManagedAttachmentRef(relativePath: string): string {
    const normalized = String(relativePath ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')

    return `${MANAGED_ATTACHMENT_SCHEME}${normalized}`
}

export function parseManagedAttachmentRef(value: string | undefined | null): string | null {
    if (!isManagedAttachmentRef(value)) return null
    const normalized = String(value)
        .slice(MANAGED_ATTACHMENT_SCHEME.length)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')

    return normalized || null
}
