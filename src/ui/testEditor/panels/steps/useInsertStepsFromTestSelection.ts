import * as React from 'react'
import type { TestCase } from '@core/domain'
import { canReferenceTestStep } from '@core/referenceSteps'

type Args = {
    open: boolean
    ownerTestId: string
    allTests: TestCase[]
}

export function useInsertStepsFromTestSelection({ open, ownerTestId, allTests }: Args) {
    const [query, setQuery] = React.useState('')
    const [selectedTestId, setSelectedTestId] = React.useState<string | null>(null)
    const [selectedStepIds, setSelectedStepIds] = React.useState<string[]>([])

    const availableTests = React.useMemo(
        () => allTests
            .filter((test) => test.id !== ownerTestId)
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
        [allTests, ownerTestId]
    )

    const filteredTests = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return availableTests

        return availableTests.filter((test) => {
            const zephyrId = String(test.links.find((link) => link.provider === 'zephyr')?.externalId ?? '').toLowerCase()
            return test.name.toLowerCase().includes(needle) || zephyrId.includes(needle)
        })
    }, [availableTests, query])

    const selectedTest = React.useMemo(() => {
        const preferred = filteredTests.find((test) => test.id === selectedTestId)
        if (preferred) return preferred
        const fallback = availableTests.find((test) => test.id === selectedTestId)
        if (fallback && !query.trim()) return fallback
        return filteredTests[0] ?? null
    }, [availableTests, filteredTests, query, selectedTestId])

    const selectableSteps = React.useMemo(
        () => selectedTest?.steps.filter(canReferenceTestStep) ?? [],
        [selectedTest]
    )

    React.useEffect(() => {
        if (!open) return
        setQuery('')
        setSelectedStepIds([])
        setSelectedTestId(availableTests[0]?.id ?? null)
    }, [availableTests, open])

    React.useEffect(() => {
        if (!open) return
        if (selectedTest && selectedTest.id !== selectedTestId) {
            setSelectedTestId(selectedTest.id)
            setSelectedStepIds([])
        }
    }, [open, selectedTest, selectedTestId])

    const selectedCount = React.useMemo(
        () => selectableSteps.filter((step) => selectedStepIds.includes(step.id)).length,
        [selectableSteps, selectedStepIds]
    )

    const canApply = Boolean(selectedTest && selectedCount > 0)

    return {
        query,
        selectedTestId,
        selectedStepIds,
        availableTests,
        filteredTests,
        selectedTest,
        selectableSteps,
        selectedCount,
        canApply,
        setQuery,
        setSelectedTestId,
        setSelectedStepIds,
    }
}
