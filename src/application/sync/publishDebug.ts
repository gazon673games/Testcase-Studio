type PublishDebugAttempt = {
    requestBody: unknown
    request?: { method?: unknown; url?: unknown; body?: unknown }
    response?: { status?: unknown; statusText?: unknown; body?: unknown }
    error: string
}

export function extractPublishDebug(
    error: unknown
): {
    upsertAttempts?: Array<{
        requestBody: unknown
        request?: { method: string; url: string; body?: unknown }
        response?: { status?: number; statusText?: string; body?: string }
        error: string
    }>
} | undefined {
    if (!error || typeof error !== 'object') return undefined

    const attempts = (error as { attempts?: unknown }).attempts
    if (!Array.isArray(attempts) || attempts.length === 0) return undefined

    return {
        upsertAttempts: attempts
            .filter((attempt): attempt is PublishDebugAttempt => {
                return Boolean(attempt && typeof attempt === 'object' && 'error' in attempt)
            })
            .map((attempt) => ({
                requestBody: attempt.requestBody,
                request:
                    attempt.request &&
                    typeof attempt.request === 'object' &&
                    typeof attempt.request.method === 'string' &&
                    typeof attempt.request.url === 'string'
                        ? {
                            method: attempt.request.method,
                            url: attempt.request.url,
                            body: attempt.request.body,
                        }
                        : undefined,
                response:
                    attempt.response && typeof attempt.response === 'object'
                        ? {
                            status: typeof attempt.response.status === 'number' ? attempt.response.status : undefined,
                            statusText: typeof attempt.response.statusText === 'string' ? attempt.response.statusText : undefined,
                            body: typeof attempt.response.body === 'string' ? attempt.response.body : undefined,
                        }
                        : undefined,
                error: String(attempt.error ?? ''),
            })),
    }
}
