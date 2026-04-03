type ZephyrAttachmentResponse = Record<string, unknown>
export type VariableTypePolicy = 'zephyr-text' | 'zephyr-string' | 'legacy-lowercase'

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

export function normalizeParameters(
    value: unknown,
    typePolicy: VariableTypePolicy = 'zephyr-text'
): { variables?: unknown[]; entries?: unknown[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    const raw = value as Record<string, unknown>
    const next: { variables?: unknown[]; entries?: unknown[] } = {}
    const variables = 'variables' in raw ? normalizeParameterVariables(raw.variables, typePolicy) : []
    const entries = 'entries' in raw && Array.isArray(raw.entries) ? raw.entries.map(normalizeStructuredValue) : []

    if (variables.length) next.variables = variables
    if (entries.length) next.entries = entries

    return next
}

function normalizeParameterVariables(value: unknown, typePolicy: VariableTypePolicy): unknown[] {
    if (!Array.isArray(value)) return []

    const byName = new Map<string, { name: string; type: string }>()

    for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
            const name = item.trim()
            if (!byName.has(name)) byName.set(name, { name, type: toZephyrVariableType('', typePolicy) })
            continue
        }

        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const raw = item as Record<string, unknown>
            const name = typeof raw.name === 'string' ? raw.name.trim() : ''
            if (!name) continue

            const rawType = typeof raw.type === 'string' ? raw.type.trim() : ''
            const type = toZephyrVariableType(rawType, typePolicy)
            if (!byName.has(name)) byName.set(name, { name, type })
        }
    }

    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name))
}

function toZephyrVariableType(rawType: string, typePolicy: VariableTypePolicy): string {
    const normalized = rawType.trim().toLowerCase()
    const family =
        normalized === 'boolean' || normalized === 'bool'
            ? 'boolean'
            : normalized === 'integer' || normalized === 'int'
                ? 'integer'
                : normalized === 'double' || normalized === 'float' || normalized === 'number' || normalized === 'numeric'
                    ? 'number'
                    : 'string'

    if (typePolicy === 'legacy-lowercase') {
        if (family === 'boolean') return 'boolean'
        if (family === 'integer') return 'integer'
        if (family === 'number') return 'double'
        return normalized || 'string'
    }

    if (typePolicy === 'zephyr-string') {
        if (family === 'boolean') return 'BOOLEAN'
        if (family === 'integer') return 'INTEGER'
        if (family === 'number') return 'DOUBLE'
        return 'STRING'
    }

    if (family === 'boolean') return 'BOOLEAN'
    if (family === 'integer') return 'INTEGER'
    if (family === 'number') return 'DOUBLE'
    return 'TEXT'
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
