import * as React from 'react'
import type { PartItem, Step } from '@core/domain'
import type { StepFieldKind } from './stepsPanelTypes'

type UseStepsPanelControllerOptions = {
    steps: Step[]
    onChange(next: Step[]): void
    focusStepId?: string | null
    previewMode?: 'raw' | 'preview'
}

function ensureParts(step: Step) {
    if (!step.presentation) step.presentation = {}
    if (!step.presentation.parts) step.presentation.parts = {}
    if (!Array.isArray(step.presentation.parts.action)) step.presentation.parts.action = []
    if (!Array.isArray(step.presentation.parts.data)) step.presentation.parts.data = []
    if (!Array.isArray(step.presentation.parts.expected)) step.presentation.parts.expected = []
}

export function useStepsPanelController({
    steps,
    onChange,
    focusStepId,
    previewMode,
}: UseStepsPanelControllerOptions) {
    const [open, setOpen] = React.useState(true)
    const [globalPreview, setGlobalPreview] = React.useState(false)
    const [isNarrow, setIsNarrow] = React.useState(false)
    const stepRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const dragIndex = React.useRef<number | null>(null)
    const focusFrame = React.useRef<number | null>(null)
    const focusTimeout = React.useRef<number | null>(null)
    const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)

    const previewEnabled = previewMode ? previewMode === 'preview' : globalPreview

    React.useEffect(() => {
        const handleResize = () => setIsNarrow(window.innerWidth < 980)
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    React.useEffect(() => {
        if (!focusStepId) return

        setOpen(true)
        focusFrame.current = requestAnimationFrame(() => {
            focusFrame.current = null
            const element = stepRefs.current[focusStepId]
            element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            if (!element) return
            element.style.outline = '2px solid var(--accent-border)'
            if (focusTimeout.current != null) {
                clearTimeout(focusTimeout.current)
            }
            focusTimeout.current = window.setTimeout(() => {
                focusTimeout.current = null
                if (element) element.style.outline = 'none'
            }, 900)
        })

        return () => {
            if (focusFrame.current != null) {
                cancelAnimationFrame(focusFrame.current)
                focusFrame.current = null
            }
            if (focusTimeout.current != null) {
                clearTimeout(focusTimeout.current)
                focusTimeout.current = null
            }
        }
    }, [focusStepId])

    const updateStep = React.useCallback((index: number, patch: Partial<Step> | Step) => {
        const next = steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step))
        onChange(next)
    }, [onChange, steps])

    const addStepAfter = React.useCallback((index: number) => {
        const newStep: Step = {
            id: crypto.randomUUID(),
            action: '',
            data: '',
            expected: '',
            text: '',
            snapshot: { action: '', data: '', expected: '' },
            presentation: { parts: { action: [], data: [], expected: [] } },
            subSteps: [],
            attachments: [],
        }

        onChange([...steps.slice(0, index + 1), newStep, ...steps.slice(index + 1)])
    }, [onChange, steps])

    const cloneStep = React.useCallback((index: number) => {
        const cloned = structuredClone(steps[index])
        cloned.id = crypto.randomUUID()
        onChange([...steps.slice(0, index + 1), cloned, ...steps.slice(index + 1)])
    }, [onChange, steps])

    const removeStep = React.useCallback((index: number) => {
        onChange(steps.filter((_, stepIndex) => stepIndex !== index))
    }, [onChange, steps])

    const addPart = React.useCallback((index: number, kind: StepFieldKind) => {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.presentation!.parts![kind]!.push({ id: crypto.randomUUID(), text: '' })
        updateStep(index, nextStep)
    }, [steps, updateStep])

    const editPart = React.useCallback((index: number, kind: StepFieldKind, partIndex: number, patch: Partial<PartItem>) => {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.presentation!.parts![kind]![partIndex] = {
            ...nextStep.presentation!.parts![kind]![partIndex],
            ...patch,
        }
        updateStep(index, nextStep)
    }, [steps, updateStep])

    const removePart = React.useCallback((index: number, kind: StepFieldKind, partIndex: number) => {
        const nextStep = structuredClone(steps[index])
        ensureParts(nextStep)
        nextStep.presentation!.parts![kind]!.splice(partIndex, 1)
        updateStep(index, nextStep)
    }, [steps, updateStep])

    const handleDragStart = React.useCallback((index: number, event: React.DragEvent) => {
        dragIndex.current = index
        setDraggingIndex(index)
        setHoverIndex(null)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
    }, [])

    const handleDragEnd = React.useCallback(() => {
        dragIndex.current = null
        setDraggingIndex(null)
        setHoverIndex(null)
    }, [])

    const handleCardDragOver = React.useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const handleCardDragEnter = React.useCallback((index: number) => {
        setHoverIndex((current) => (draggingIndex != null && index !== draggingIndex ? index : current))
    }, [draggingIndex])

    const handleCardDragLeave = React.useCallback((index: number) => {
        setHoverIndex((current) => (current === index ? null : current))
    }, [])

    const handleCardDrop = React.useCallback((index: number) => {
        const from = dragIndex.current
        dragIndex.current = null
        setDraggingIndex(null)
        setHoverIndex(null)
        if (from == null || from === index) return

        const next = steps.slice()
        const [moved] = next.splice(from, 1)
        next.splice(index, 0, moved)
        onChange(next)
    }, [onChange, steps])

    return {
        open,
        setOpen,
        globalPreview,
        setGlobalPreview,
        isNarrow,
        previewEnabled,
        stepRefs,
        draggingIndex,
        hoverIndex,
        updateStep,
        addStepAfter,
        cloneStep,
        removeStep,
        addPart,
        editPart,
        removePart,
        handleDragStart,
        handleDragEnd,
        handleCardDragOver,
        handleCardDragEnter,
        handleCardDragLeave,
        handleCardDrop,
    }
}
