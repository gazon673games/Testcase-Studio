export const NODE_ALIAS_PARAM_KEY = 'ui.alias'

type MetaLike = {
    params?: Record<string, string> | null | undefined
} | null | undefined

type FolderLike = {
    alias?: string | null | undefined
} | null | undefined

export function normalizeNodeAlias(value: unknown) {
    const normalized = String(value ?? '').trim()
    return normalized || null
}

export function getStoredTestAlias(meta: MetaLike) {
    return normalizeNodeAlias(meta?.params?.[NODE_ALIAS_PARAM_KEY])
}

export function getStoredFolderAlias(folder: FolderLike) {
    return normalizeNodeAlias(folder?.alias)
}
