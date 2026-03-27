import { RootState, mkFolder, normalizeRootState } from './domain'
import { apiClient } from '@ipc/client'

const DEFAULT_STATE: RootState = {
    root: mkFolder('Root', []),
    sharedSteps: []
}

export async function loadState(): Promise<RootState> {
    const raw = await apiClient.loadState<RootState>(DEFAULT_STATE)
    return normalizeRootState(raw)
}

export async function saveState(state: RootState): Promise<void> {
    await apiClient.saveState<RootState>(normalizeRootState(state))
}
