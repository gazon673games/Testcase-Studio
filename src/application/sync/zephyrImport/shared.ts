import type { TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'

export function compareImportTargets(left: ProviderTest, right: ProviderTest): number {
    const leftFolder = remoteFolderValue(left)
    const rightFolder = remoteFolderValue(right)
    return `${leftFolder}\u0000${left.name}`.localeCompare(`${rightFolder}\u0000${right.name}`)
}

export function remoteFolderValue(remote: ProviderTest): string {
    return safeString(remote.extras?.folder) ?? ''
}

export function normalizeZephyrRef(value: unknown): string {
    return String(value ?? '').trim().toUpperCase()
}

export function dedupeRefs(values: string[]): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const value of values) {
        const normalized = normalizeZephyrRef(value)
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        out.push(normalized)
    }
    return out
}

export function dedupeTests(values: TestCase[]): TestCase[] {
    const out: TestCase[] = []
    const seen = new Set<string>()
    for (const value of values) {
        if (seen.has(value.id)) continue
        seen.add(value.id)
        out.push(value)
    }
    return out
}

export function extractTrailingDigits(value: unknown): string {
    const match = String(value ?? '').match(/(\d+)\s*$/)
    return match?.[1] ?? ''
}

export function escapeQueryValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function safeString(value: unknown): string | undefined {
    const next = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    return next || undefined
}

export function stableJson(value: unknown): string {
    return JSON.stringify(value)
}
