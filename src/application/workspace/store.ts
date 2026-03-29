import { mkFolder, normalizeRootState, type RootState } from '@core/domain'
import { apiClient } from '@ipc/client'

const DEFAULT_STATE: RootState = {
    root: mkFolder('Root', []),
    sharedSteps: [],
}

export async function loadWorkspaceState(): Promise<RootState> {
    const raw = await apiClient.loadState<RootState>(DEFAULT_STATE)
    return normalizeRootState(raw)
}

export async function saveWorkspaceState(state: RootState): Promise<void> {
    await apiClient.saveState<RootState>(normalizeRootState(state))
}

export async function writeWorkspaceSnapshot(
    state: RootState,
    kind = 'snapshot',
    meta?: Record<string, unknown>
): Promise<string> {
    return apiClient.writeStateSnapshot(normalizeRootState(state), kind, meta)
}

export async function writeWorkspacePublishLog(payload: Record<string, unknown>): Promise<string> {
    return apiClient.writePublishLog(payload)
}
