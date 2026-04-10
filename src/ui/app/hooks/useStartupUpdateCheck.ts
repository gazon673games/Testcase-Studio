import * as React from 'react'
import { apiClient } from '@ipc/client'
import type { AppUpdateCheckResult } from '@shared/appUpdates'

export function useStartupUpdateCheck() {
    const [startupUpdate, setStartupUpdate] = React.useState<AppUpdateCheckResult | null>(null)
    const checkedStartupUpdateRef = React.useRef(false)

    React.useEffect(() => {
        if (checkedStartupUpdateRef.current) return
        checkedStartupUpdateRef.current = true
        void apiClient.checkForUpdates()
            .then((result) => {
                if (!result.isPackaged || !result.updateAvailable) return
                setStartupUpdate(result)
            })
            .catch(() => {
                // Best-effort startup check only.
            })
    }, [])

    return {
        startupUpdate,
        dismissStartupUpdate: () => setStartupUpdate(null),
    }
}
