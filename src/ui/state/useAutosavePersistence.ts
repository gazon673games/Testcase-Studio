import * as React from 'react'
import type { RootState } from '@core/domain'

const AUTOSAVE_DELAY_MS = 700

type UseAutosavePersistenceOptions = {
    saveWorkspace: (snapshot: RootState) => Promise<boolean>
    latestStateRef: React.MutableRefObject<RootState | null>
    latestRevisionRef: React.MutableRefObject<number>
    hasUnsavedChangesRef: React.MutableRefObject<boolean>
    saveErrorRef: React.MutableRefObject<string | null>
    clearDirty: (testIds?: string[]) => void
    setIsSaving: (value: boolean) => void
    setSaveError: (value: string | null) => void
    setHasUnsavedChanges: (value: boolean) => void
}

export function useAutosavePersistence({
    saveWorkspace,
    latestStateRef,
    latestRevisionRef,
    hasUnsavedChangesRef,
    saveErrorRef,
    clearDirty,
    setIsSaving,
    setSaveError,
    setHasUnsavedChanges,
}: UseAutosavePersistenceOptions) {
    const saveTimerRef = React.useRef<number | null>(null)
    const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
    const activeSavesRef = React.useRef(0)

    const cancelScheduledSave = React.useCallback(() => {
        if (saveTimerRef.current == null) return
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
    }, [])

    React.useEffect(() => () => cancelScheduledSave(), [cancelScheduledSave])

    const runQueuedSave = React.useCallback(
        async (snapshot: RootState, revision: number) => {
            activeSavesRef.current += 1
            setIsSaving(true)
            setSaveError(null)
            try {
                const saved = await saveWorkspace(snapshot)
                if (!saved) return false
                if (latestRevisionRef.current === revision) {
                    setHasUnsavedChanges(false)
                    clearDirty()
                }
                return true
            } catch (error) {
                if (latestRevisionRef.current === revision) {
                    setHasUnsavedChanges(true)
                    setSaveError(error instanceof Error ? error.message : String(error))
                }
                throw error
            } finally {
                activeSavesRef.current -= 1
                if (activeSavesRef.current === 0) setIsSaving(false)
            }
        },
        [clearDirty, saveWorkspace, setHasUnsavedChanges, setIsSaving, setSaveError, latestRevisionRef]
    )

    const enqueueSave = React.useCallback(
        (snapshot: RootState, revision: number) => {
            const job = saveQueueRef.current
                .catch(() => undefined)
                .then(async () => {
                    await runQueuedSave(snapshot, revision)
                })
            saveQueueRef.current = job.catch(() => undefined)
            return job
        },
        [runQueuedSave]
    )

    const scheduleSave = React.useCallback(() => {
        cancelScheduledSave()
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null
            const snapshot = latestStateRef.current
            if (!snapshot) return
            void enqueueSave(snapshot, latestRevisionRef.current).catch(() => undefined)
        }, AUTOSAVE_DELAY_MS)
    }, [cancelScheduledSave, enqueueSave, latestRevisionRef, latestStateRef])

    const flushSave = React.useCallback(async () => {
        const snapshot = latestStateRef.current
        if (!snapshot) return false

        const hasScheduledSave = saveTimerRef.current != null
        if (!hasUnsavedChangesRef.current && !hasScheduledSave && !saveErrorRef.current) {
            await saveQueueRef.current
            return true
        }

        cancelScheduledSave()
        await enqueueSave(snapshot, latestRevisionRef.current)
        return true
    }, [cancelScheduledSave, enqueueSave, hasUnsavedChangesRef, latestRevisionRef, latestStateRef, saveErrorRef])

    const waitForPendingSaves = React.useCallback(() => saveQueueRef.current, [])

    return {
        cancelScheduledSave,
        enqueueSave,
        scheduleSave,
        flushSave,
        waitForPendingSaves,
    }
}
