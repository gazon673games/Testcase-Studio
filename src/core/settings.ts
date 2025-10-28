export type AtlassianSettings = {
    email: string
    hasSecret: boolean
}

export const DEFAULT_SETTINGS: AtlassianSettings = {
    email: "",
    hasSecret: false
}