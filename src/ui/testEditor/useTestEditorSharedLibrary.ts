import * as React from 'react'
import type { ResolvedWikiRef, SharedUsage } from '@core/refs'
import type { SharedStep, Step } from '@core/domain'

type Options = {
    sharedSteps: SharedStep[]
    setShowSharedLibrary: React.Dispatch<React.SetStateAction<boolean>>
    onAddSharedStep(): Promise<string | null> | string | null
    onAddSharedStepFromStep(step: Step, name?: string): Promise<string | null> | string | null
    onDeleteSharedStep(sharedId: string): void | Promise<void>
    onOpenStep(testId: string, stepId: string): void
    onOpenTest(testId: string): void
}

export function useTestEditorSharedLibrary({
    sharedSteps,
    setShowSharedLibrary,
    onAddSharedStep,
    onAddSharedStepFromStep,
    onDeleteSharedStep,
    onOpenStep,
    onOpenTest,
}: Options) {
    const [selectedSharedId, setSelectedSharedId] = React.useState<string | null>(sharedSteps[0]?.id ?? null)
    const [focusSharedStepId, setFocusSharedStepId] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!selectedSharedId && sharedSteps[0]) setSelectedSharedId(sharedSteps[0].id)
        if (selectedSharedId && !sharedSteps.some((item) => item.id === selectedSharedId)) {
            setSelectedSharedId(sharedSteps[0]?.id ?? null)
            setFocusSharedStepId(null)
        }
    }, [selectedSharedId, sharedSteps])

    const openResolvedRef = React.useCallback((refInfo: ResolvedWikiRef) => {
        if (!refInfo.ok || !refInfo.ownerId) return
        if (refInfo.ownerType === 'shared') {
            setShowSharedLibrary(true)
            setSelectedSharedId(refInfo.ownerId)
            setFocusSharedStepId(refInfo.stepId ?? null)
            return
        }

        if (refInfo.stepId) onOpenStep(refInfo.ownerId, refInfo.stepId)
        else onOpenTest(refInfo.ownerId)
    }, [onOpenStep, onOpenTest])

    const openUsage = React.useCallback((usage: SharedUsage) => {
        if (usage.ownerType === 'shared') {
            setShowSharedLibrary(true)
            setSelectedSharedId(usage.ownerId)
            setFocusSharedStepId(usage.sourceStepId ?? null)
            return
        }

        if (usage.sourceStepId) onOpenStep(usage.ownerId, usage.sourceStepId)
        else onOpenTest(usage.ownerId)
    }, [onOpenStep, onOpenTest])

    const handleAddShared = React.useCallback(async () => {
        const created = await onAddSharedStep()
        if (!created) return
        setShowSharedLibrary(true)
        setSelectedSharedId(created)
        setFocusSharedStepId(null)
    }, [onAddSharedStep])

    const handleCreateSharedFromStep = React.useCallback(async (step: Step, name?: string) => {
        const created = await onAddSharedStepFromStep(step, name)
        if (!created) return
        setShowSharedLibrary(true)
        setSelectedSharedId(created)
        setFocusSharedStepId(step.id)
    }, [onAddSharedStepFromStep])

    const handleOpenShared = React.useCallback((sharedId: string, stepId?: string) => {
        setShowSharedLibrary(true)
        setSelectedSharedId(sharedId)
        setFocusSharedStepId(stepId ?? null)
    }, [])

    const handleSelectShared = React.useCallback((sharedId: string) => {
        setSelectedSharedId(sharedId)
        setFocusSharedStepId(null)
    }, [])

    const handleDeleteShared = React.useCallback((sharedId: string) => {
        void onDeleteSharedStep(sharedId)
        if (selectedSharedId === sharedId) {
            setSelectedSharedId(null)
            setFocusSharedStepId(null)
        }
    }, [onDeleteSharedStep, selectedSharedId])

    return {
        selectedSharedId,
        focusSharedStepId,
        openResolvedRef,
        openUsage,
        handleAddShared,
        handleCreateSharedFromStep,
        handleOpenShared,
        handleSelectShared,
        handleDeleteShared,
    }
}
