import * as React from 'react'

export function useStoredToggle(key: string, initialValue: boolean) {
    const [value, setValue] = React.useState(() => {
        try {
            const stored = window.localStorage.getItem(key)
            if (stored == null) return initialValue
            return stored === '1'
        } catch {
            return initialValue
        }
    })

    React.useEffect(() => {
        try {
            window.localStorage.setItem(key, value ? '1' : '0')
        } catch {
            // local persistence is best-effort only
        }
    }, [key, value])

    return [value, setValue] as const
}
