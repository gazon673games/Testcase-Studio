import * as React from 'react'
import { loadWorkspaceState, saveWorkspace as saveWorkspaceUseCase } from '@app/workspace'
import { type ID, type RootState } from '@core/domain'
import { mapTests } from '@core/tree'
import type { AppServices } from '../services'
import { createAppStateSelection } from './appStateSelection'
import { createAppStateSyncActions } from './appStateSyncActions'
import { createAppStateWorkspaceActions } from './appStateWorkspaceActions'
import { useAutosavePersistence } from './useAutosavePersistence'

type SaveState = 'saved' | 'pending' | 'saving' | 'error'

export function useAppState(services: AppServices) {
    const [state, setState] = React.useState<RootState | null>(null)
    const [selectedId, setSelectedId] = React.useState<ID | null>(null)
    const [focusStepId, setFocusStepId] = React.useState<string | null>(null)
    const [dirtyTestIds, setDirtyTestIds] = React.useState<Set<string>>(() => new Set())
    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [hasUnsavedChanges, setHasUnsavedChangesState] = React.useState(false)
    const [saveError, setSaveErrorState] = React.useState<string | null>(null)
    const [isSaving, setIsSaving] = React.useState(false)

    const latestStateRef = React.useRef<RootState | null>(null)
    const latestRevisionRef = React.useRef(0)
    const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges)
    const saveErrorRef = React.useRef<string | null>(saveError)

    const sync = services.sync

    const setHasUnsavedChanges = React.useCallback((value: boolean) => {
        hasUnsavedChangesRef.current = value
        setHasUnsavedChangesState(value)
    }, [])

    const setSaveError = React.useCallback((value: string | null) => {
        saveErrorRef.current = value
        setSaveErrorState(value)
    }, [])

    React.useEffect(() => {
        let cancelled = false

        loadWorkspaceState()
            .then((nextState) => {
                if (cancelled) return
                latestStateRef.current = nextState
                latestRevisionRef.current = 0
                setState(nextState)
                setSelectedId(nextState.root.id)
                setDirtyTestIds(new Set())
                setHasUnsavedChanges(false)
                setSaveError(null)
                setLoadError(null)
            })
            .catch((error) => {
                if (cancelled) return
                latestStateRef.current = null
                latestRevisionRef.current = 0
                setState(null)
                setSelectedId(null)
                setFocusStepId(null)
                setDirtyTestIds(new Set())
                setHasUnsavedChanges(false)
                setSaveError(null)
                setLoadError(error instanceof Error ? error.message : String(error))
            })

        return () => {
            cancelled = true
        }
    }, [])

    function markDirty(testIds?: string[]) {
        if (!testIds?.length) return
        const ids = testIds.map((id) => String(id || '').trim()).filter(Boolean)
        if (!ids.length) return
        setDirtyTestIds((current) => {
            const next = new Set(current)
            ids.forEach((id) => next.add(id))
            return next
        })
    }

    function clearDirty(testIds?: string[]) {
        if (!testIds || !testIds.length) {
            setDirtyTestIds(new Set())
            return
        }
        const ids = testIds.map((id) => String(id || '').trim()).filter(Boolean)
        if (!ids.length) return
        setDirtyTestIds((current) => {
            const next = new Set(current)
            ids.forEach((id) => next.delete(id))
            return next
        })
    }

    function getCurrentState() {
        return latestStateRef.current ?? state
    }

    const adoptStateSnapshot = React.useCallback((next: RootState) => {
        // Workspace commands/use-cases already return an isolated next snapshot.
        // We keep ownership of that object here instead of cloning the full tree again.
        latestStateRef.current = next
        latestRevisionRef.current += 1
        setState(next)
        return latestRevisionRef.current
    }, [])

    const { cancelScheduledSave, enqueueSave, scheduleSave, flushSave, waitForPendingSaves } = useAutosavePersistence({
        saveWorkspace: saveWorkspaceUseCase,
        latestStateRef,
        latestRevisionRef,
        hasUnsavedChangesRef,
        saveErrorRef,
        clearDirty,
        setIsSaving,
        setSaveError,
        setHasUnsavedChanges,
    })

    const stageLocalState = React.useCallback(
        (next: RootState, dirtyIds?: string[]) => {
            adoptStateSnapshot(next)
            markDirty(dirtyIds)
            setHasUnsavedChanges(true)
            setSaveError(null)
            scheduleSave()
        },
        [adoptStateSnapshot, scheduleSave]
    )

    const persistStateNow = React.useCallback(
        async (next: RootState, dirtyIds?: string[]) => {
            const revision = adoptStateSnapshot(next)
            markDirty(dirtyIds)
            setHasUnsavedChanges(true)
            setSaveError(null)
            cancelScheduledSave()
            await enqueueSave(next, revision)
        },
        [adoptStateSnapshot, cancelScheduledSave, enqueueSave]
    )

    const selectionApi = createAppStateSelection({
        getCurrentState,
        selectedId,
        rootLabel: services.defaults.rootLabel,
        setSelectedId,
        setFocusStepId,
    })

    const workspaceApi = createAppStateWorkspaceActions({
        getCurrentState,
        selectedId,
        defaults: services.defaults,
        stageLocalState,
        persistStateNow,
        setSelectedId,
        setFocusStepId,
    })

    const syncApi = createAppStateSyncActions({
        getCurrentState,
        selectedId,
        sync,
        rootLabel: services.defaults.rootLabel,
        persistStateNow,
        clearDirty,
        cancelScheduledSave,
        waitForPendingSaves,
        adoptStateSnapshot,
        setHasUnsavedChanges,
        setSaveError,
    })

    async function save() {
        return flushSave()
    }

    const saveState: SaveState = saveError
        ? 'error'
        : isSaving
            ? 'saving'
            : hasUnsavedChanges
                ? 'pending'
                : 'saved'

    const stateApi = {
        state,
        selectedId,
        dirtyTestIds,
        loadError,
        saveState,
        saveError,
        hasUnsavedChanges,
        focusStepId,
        mapAllTests: () => (getCurrentState() ? mapTests(getCurrentState()!.root) : []),
    }

    const persistenceApi = {
        save,
    }

    return {
        ...stateApi,
        ...selectionApi,
        ...workspaceApi,
        ...persistenceApi,
        ...syncApi,
    }
}
