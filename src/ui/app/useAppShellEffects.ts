import * as React from 'react'

type UseAppShellEffectsOptions = {
    onSave(): Promise<void> | void
    setCompactWorkspace: React.Dispatch<React.SetStateAction<boolean>>
}

export function useAppShellEffects({ onSave, setCompactWorkspace }: UseAppShellEffectsOptions) {
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const modifier = isMac ? event.metaKey : event.ctrlKey

            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault()
                void onSave()
            }
        }

        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
    }, [onSave])

    React.useEffect(() => {
        const onResize = () => setCompactWorkspace(window.innerWidth < 980)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [setCompactWorkspace])
}
