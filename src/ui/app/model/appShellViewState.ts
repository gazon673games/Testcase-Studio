import { findNode, isFolder } from '@core/tree'
import { buildSelectionSummary } from './selectionSummary'
import type { useAppState } from '../../state/useAppState'

type Translate = (key: any, params?: Record<string, string | number>) => string
type AppStateApi = ReturnType<typeof useAppState>

export function buildAppShellViewState(
    app: AppStateApi,
    t: Translate,
    rootLabel: string
) {
    const state = app.state
    if (!state) return null

    const selected = app.selectedId ? findNode(state.root, app.selectedId) : null
    const selectedTest = selected && !isFolder(selected) ? selected : null
    const allTests = app.mapAllTests()
    const importDestination = app.getImportDestination()
    const publishSelection = app.getPublishSelection()
    const selectionSummary = buildSelectionSummary(state.root, selected, t, rootLabel)

    return {
        selected,
        selectedTest,
        allTests,
        importDestination,
        publishSelection,
        selectionSummary,
        canDelete: !!selected && selected.id !== state.root.id,
        canExport: !!selectedTest,
        canPull: !!selectedTest,
        canPush: !!selectedTest,
        canPublish: publishSelection.tests.length > 0,
        canSyncAll: allTests.some((test) => (test.links?.length ?? 0) > 0),
    }
}
