import * as React from 'react'
import type { IncludedCaseCandidate } from '@app/workspace'
import type { ZephyrPublishPreview } from '@app/sync'

export function useAppShellDialogs() {
    const [settingsOpen, setSettingsOpen] = React.useState(false)
    const [importOpen, setImportOpen] = React.useState(false)
    const [publishOpen, setPublishOpen] = React.useState(false)
    const [syncCenterOpen, setSyncCenterOpen] = React.useState(false)
    const [createFromScratchPreview, setCreateFromScratchPreview] = React.useState<ZephyrPublishPreview | null>(null)
    const [includedCasesOpen, setIncludedCasesOpen] = React.useState(false)
    const [includedCasesItems, setIncludedCasesItems] = React.useState<IncludedCaseCandidate[]>([])

    const openIncludedCasesResolution = React.useCallback((items: IncludedCaseCandidate[]) => {
        if (!items.length) return
        setIncludedCasesItems(items)
        setIncludedCasesOpen(true)
    }, [])

    const closeIncludedCasesResolution = React.useCallback(() => {
        setIncludedCasesOpen(false)
        setIncludedCasesItems([])
    }, [])

    return {
        settingsOpen,
        importOpen,
        publishOpen,
        syncCenterOpen,
        createFromScratchPreview,
        includedCasesOpen,
        includedCasesItems,
        setSettingsOpen,
        setImportOpen,
        setPublishOpen,
        setSyncCenterOpen,
        setCreateFromScratchPreview,
        openIncludedCasesResolution,
        closeIncludedCasesResolution,
    }
}
