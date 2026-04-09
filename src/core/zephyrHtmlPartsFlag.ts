import type { TestMeta } from './domain'

export const ZEPHYR_PARSE_HTML_PARTS_KEY = '__zephyr.parseHtmlParts'

export function isZephyrHtmlPartsEnabled(meta: Pick<TestMeta, 'params'> | undefined): boolean {
    const raw = String(meta?.params?.[ZEPHYR_PARSE_HTML_PARTS_KEY] ?? '').trim().toLowerCase()
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on'
}

export function setZephyrHtmlPartsEnabled(meta: TestMeta | undefined, enabled: boolean): TestMeta {
    const nextMeta: TestMeta = {
        ...(meta ?? { tags: [], params: {} }),
        tags: [...(meta?.tags ?? [])],
        params: { ...(meta?.params ?? {}) },
    }

    if (enabled) nextMeta.params![ZEPHYR_PARSE_HTML_PARTS_KEY] = 'true'
    else delete nextMeta.params![ZEPHYR_PARSE_HTML_PARTS_KEY]

    return nextMeta
}

export function preserveZephyrHtmlPartsFlag(existing: TestMeta | undefined, next: TestMeta | undefined): TestMeta | undefined {
    if (!isZephyrHtmlPartsEnabled(existing)) return next
    return setZephyrHtmlPartsEnabled(next, true)
}
