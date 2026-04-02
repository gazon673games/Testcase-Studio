import { getImportDestination as getImportDestinationQuery, getPublishSelection as getPublishSelectionQuery, getSelectedNode } from '@app/workspace'
import type { Folder, ID, RootState, TestCase } from '@core/domain'

type Node = Folder | TestCase

type AppStateSelectionOptions = {
    getCurrentState: () => RootState | null
    selectedId: ID | null
    rootLabel: string
    setSelectedId: (id: ID | null) => void
    setFocusStepId: (stepId: string | null) => void
}

export function createAppStateSelection({
    getCurrentState,
    selectedId,
    rootLabel,
    setSelectedId,
    setFocusStepId,
}: AppStateSelectionOptions) {
    function getSelected(): Node | null {
        return getSelectedNode(getCurrentState(), selectedId)
    }

    function select(id: ID) {
        setSelectedId(id)
        setFocusStepId(null)
    }

    function getImportDestination() {
        return getImportDestinationQuery(getCurrentState(), selectedId, rootLabel)
    }

    function getPublishSelection() {
        return getPublishSelectionQuery(getCurrentState(), selectedId, rootLabel)
    }

    function openStep(testId: string, stepId: string) {
        setSelectedId(testId)
        setFocusStepId(stepId)
    }

    return {
        getSelected,
        select,
        getImportDestination,
        getPublishSelection,
        openStep,
    }
}
