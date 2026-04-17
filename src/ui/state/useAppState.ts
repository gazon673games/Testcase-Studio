import * as React from 'react'
import type { AppServices } from '../services'
import { useWorkspaceStore } from './workspaceStore'

export type { WorkspaceStore as AppStateApi } from './workspaceStore'

/**
 * Thin wrapper over the Zustand workspace store.
 *
 * Responsibilities:
 *  - Injects locale-sensitive services into the store when they change
 *  - Triggers the initial workspace load on mount
 *  - Exposes a derived `saveState` string for the toolbar
 */
export function useAppState(services: AppServices) {
    const store = useWorkspaceStore()

    // Keep services (defaults labels, sync engine) in sync with the active locale
    React.useEffect(() => {
        store.setServices(services)
    }, [services]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load workspace once on mount
    React.useEffect(() => {
        void store.load()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const saveState = (
        store.saveError ? 'error' : store.isSaving ? 'saving' : store.hasUnsavedChanges ? 'pending' : 'saved'
    ) as 'error' | 'saving' | 'pending' | 'saved'

    return { ...store, saveState }
}
