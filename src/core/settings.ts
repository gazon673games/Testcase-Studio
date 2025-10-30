export type AtlassianSettings = {
    login: string
    baseUrl: string
    hasSecret: boolean
}

export const DEFAULT_SETTINGS: AtlassianSettings = {
    login: "",
    baseUrl: "",
    hasSecret: false
}