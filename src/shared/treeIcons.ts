export const NODE_ICON_PARAM_KEY = 'ui.icon'
export const TEST_ICON_PARAM_KEY = NODE_ICON_PARAM_KEY

export type LocalTreeIconOption = {
    key: string
    label: string
    dataUrl: string
}

export type LocalTestIconOption = LocalTreeIconOption

type MetaLike = {
    params?: Record<string, string> | null | undefined
} | null | undefined

type FolderLike = {
    iconKey?: string | null | undefined
} | null | undefined

export function normalizeNodeIconKey(value: unknown) {
    const normalized = String(value ?? '').trim()
    return normalized || null
}

export function getStoredNodeIconKey(meta: MetaLike) {
    return normalizeNodeIconKey(meta?.params?.[NODE_ICON_PARAM_KEY])
}

export function getStoredTestIconKey(meta: MetaLike) {
    return getStoredNodeIconKey(meta)
}

export function getStoredFolderIconKey(folder: FolderLike) {
    return normalizeNodeIconKey(folder?.iconKey)
}
