function safeHost(url: string): string {
    try {
        return new URL(url).host
    } catch {
        return url
    }
}

export function describeFetchFailure(error: unknown): string {
    if (!(error instanceof Error)) return String(error)

    const cause = (error as Error & { cause?: unknown }).cause
    const causeMessage = cause instanceof Error
        ? cause.message
        : cause != null
            ? String(cause)
            : ''
    const combinedMessage = [error.message, causeMessage].filter(Boolean).join(' | ')
    const normalizedMessage = combinedMessage.toLowerCase()

    if (normalizedMessage.includes('enotfound') || normalizedMessage.includes('getaddrinfo') || normalizedMessage.includes('dns')) {
        return 'host was not resolved; check VPN/corporate DNS or base URL'
    }
    if (normalizedMessage.includes('self signed') || normalizedMessage.includes('certificate') || normalizedMessage.includes('cert')) {
        return 'TLS certificate validation failed'
    }
    if (normalizedMessage.includes('econnrefused')) {
        return 'connection was refused by the remote host'
    }
    if (normalizedMessage.includes('etimedout') || normalizedMessage.includes('timeout')) {
        return 'request timed out'
    }
    if (normalizedMessage.includes('fetch failed')) {
        return causeMessage || error.message
    }

    return combinedMessage
}

export async function fetchWithContext(url: string, init: RequestInit, scope: string) {
    try {
        return await fetch(url, init)
    } catch (error) {
        const host = safeHost(url)
        const detail = describeFetchFailure(error)
        throw new Error(`${scope} network error for ${host}${detail ? `: ${detail}` : ''}`)
    }
}

export async function readJsonResponse<T>(
    response: Response,
    scope: string,
    limit = 400,
    fallback?: T
): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(
            `${scope} ${response.status} ${response.statusText}` +
            (text ? ` - ${text.slice(0, limit)}` : '')
        )
    }

    return await response.json().catch(() => fallback as T)
}

export async function ensureOk(response: Response, scope: string, limit = 400) {
    if (response.ok) return

    const text = await response.text().catch(() => '')
    throw new Error(
        `${scope} ${response.status} ${response.statusText}` +
        (text ? ` - ${text.slice(0, limit)}` : '')
    )
}
