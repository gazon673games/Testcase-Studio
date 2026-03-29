import { SyncEngine } from '@app/sync'
import type { RootState } from '@core/domain'
import type { ZephyrImportPreview, ZephyrImportRequest } from '@app/sync'
import { getImportDestination } from './queries'

export async function previewZephyrImport(
    state: RootState | null,
    selectedId: string | null,
    sync: SyncEngine,
    rootLabel: string,
    request: Omit<ZephyrImportRequest, 'destinationFolderId'> & { destinationFolderId?: string }
): Promise<ZephyrImportPreview> {
    if (!state) throw new Error('State is not loaded yet')
    const destinationFolderId = request.destinationFolderId || getImportDestination(state, selectedId, rootLabel).folderId || state.root.id
    return sync.previewZephyrImport(state, { ...request, destinationFolderId })
}
