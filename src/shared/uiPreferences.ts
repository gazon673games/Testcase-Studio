const JSON_BEAUTIFY_TOLERANT_STORAGE_KEY = 'ui.jsonBeautifyTolerant'

export function getStoredJsonBeautifyTolerant(): boolean {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem(JSON_BEAUTIFY_TOLERANT_STORAGE_KEY)
    const normalized = String(stored ?? '').trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

export function setStoredJsonBeautifyTolerant(enabled: boolean) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(JSON_BEAUTIFY_TOLERANT_STORAGE_KEY, enabled ? 'true' : 'false')
}
