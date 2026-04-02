export function parseZephyrRef(raw: string): { by: 'id' | 'key'; ref: string } {
    const value = String(raw ?? '').trim()
    if (/^\d+$/.test(value)) return { by: 'id', ref: value }
    if (/-/.test(value)) return { by: 'key', ref: value }
    return { by: 'key', ref: value }
}
