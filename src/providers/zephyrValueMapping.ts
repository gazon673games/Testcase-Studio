type ParameterMode = 'structured' | 'name-list'
type ZephyrAttachmentResponse = Record<string, unknown>

export function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}

export function normalizeRemoteAttachments(values: ZephyrAttachmentResponse[] | undefined, scope: string) {
    if (!Array.isArray(values)) return []

    return values
        .map((value, index) => {
            const id = safeStr(value?.id ?? value?.attachmentId ?? `${scope}:${index + 1}`).trim()
            const name =
                safeStr(value?.name ?? value?.fileName ?? value?.filename ?? value?.title).trim() ||
                `attachment-${index + 1}`
            const pathOrDataUrl =
                safeStr(value?.downloadUrl ?? value?.content ?? value?.url ?? value?.href ?? value?.self).trim()
            return { id, name, pathOrDataUrl }
        })
        .filter((attachment): attachment is { id: string; name: string; pathOrDataUrl: string } => Boolean(attachment.name))
}

export function normalizeCustomFields(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => Boolean(String(key).trim()))
            .map(([key, item]) => [String(key).trim(), normalizeStructuredValue(item)])
    )
}

export function normalizeParameters(value: unknown, mode: ParameterMode): { variables?: unknown[]; entries?: unknown[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    const raw = value as Record<string, unknown>
    const next: { variables?: unknown[]; entries?: unknown[] } = {}
    const variables = 'variables' in raw ? normalizeParameterVariables(raw.variables, mode) : []
    const entries = 'entries' in raw && Array.isArray(raw.entries) ? raw.entries.map(normalizeStructuredValue) : []

    if (variables.length) next.variables = variables
    if (entries.length) next.entries = entries

    return next
}

function normalizeParameterVariables(value: unknown, mode: ParameterMode): unknown[] {
    if (!Array.isArray(value)) return []

    const names: string[] = []
    const structured: Record<string, unknown>[] = []

    for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
            const name = item.trim()
            names.push(name)
            structured.push({ name, defaultValue: '' })
            continue
        }

        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const raw = item as Record<string, unknown>
            const name = typeof raw.name === 'string' ? raw.name.trim() : ''
            if (!name) continue

            names.push(name)
            structured.push({
                ...Object.fromEntries(
                    Object.entries(raw).map(([key, entry]) => [key, normalizeStructuredValue(entry)])
                ),
                name,
                defaultValue: typeof raw.defaultValue === 'string' ? raw.defaultValue : '',
            })
        }
    }

    const uniqueNames = [...new Set(names)].sort((left, right) => left.localeCompare(right))
    if (mode === 'name-list') return uniqueNames

    const byName = new Map<string, Record<string, unknown>>()
    for (const item of structured) {
        const name = typeof item.name === 'string' ? item.name : ''
        if (!name || byName.has(name)) continue
        byName.set(name, item)
    }

    return [...byName.values()].sort((left, right) => String(left.name).localeCompare(String(right.name)))
}

export function normalizeStructuredValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => normalizeStructuredValue(item))

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeStructuredValue(item)])
        )
    }

    return value
}
