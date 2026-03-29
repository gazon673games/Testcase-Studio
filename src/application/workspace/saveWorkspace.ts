import type { RootState } from '@core/domain'
import { saveWorkspaceState } from './store'

export async function saveWorkspace(state: RootState | null): Promise<boolean> {
    if (!state) return false
    await saveWorkspaceState(state)
    return true
}
