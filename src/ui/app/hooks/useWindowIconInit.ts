import * as React from 'react'
import { apiClient } from '@ipc/client'
import ghostIconUrl from '../../assets/icons/ghost.svg'
import { svgUrlToPngBuffer } from '../../assets/icons/svgToPng'

/**
 * On first launch (no custom icon stored), automatically sets the ant icon.
 * Runs once on mount — subsequent launches keep whatever the user chose.
 */
export function useWindowIconInit() {
    React.useEffect(() => {
        apiClient.getWindowIcon()
            .then((current) => {
                if (current) return
                return svgUrlToPngBuffer(ghostIconUrl, 256)
                    .then((pngBytes) => apiClient.setWindowIcon(pngBytes))
            })
            .catch(() => { /* non-critical — ignore */ })
    }, [])
}
