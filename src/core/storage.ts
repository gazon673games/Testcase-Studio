import { RootState, mkFolder } from './domain'
import { apiClient } from '@ipc/client'

const DEFAULT_STATE: RootState = {
    root: mkFolder('Root', []),
    sharedSteps: []
}

export async function loadState(): Promise<RootState> {
    return apiClient.loadState<RootState>(DEFAULT_STATE)
}

export async function saveState(state: RootState): Promise<void> {
    await apiClient.saveState<RootState>(state)
}
