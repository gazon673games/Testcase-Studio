import * as React from 'react'
import type { Step } from '@core/domain'

type Props = {
    step: Step
    index: number
    eager: boolean
    isNarrow: boolean
    preview: boolean
    onMeasureRef?(element: HTMLDivElement | null): void
    children: React.ReactNode
}

const VIEWPORT_ROOT_MARGIN = '900px 0px 900px 0px'

function estimateStepCardHeight(step: Step, preview: boolean, isNarrow: boolean) {
    if (step.usesShared) {
        return 160
    }

    const partsCount =
        (step.presentation?.parts?.action?.length ?? 0) +
        (step.presentation?.parts?.data?.length ?? 0) +
        (step.presentation?.parts?.expected?.length ?? 0)
    const attachmentsCount = step.attachments?.length ?? 0
    const nestedCount = step.subSteps?.length ?? 0
    const textLength =
        String(step.action ?? step.text ?? '').length +
        String(step.data ?? '').length +
        String(step.expected ?? '').length

    const baseHeight = isNarrow ? 320 : 260
    const textBoost = Math.min(220, Math.ceil(textLength / 180) * 26)
    const partBoost = partsCount * 74
    const nestedBoost = nestedCount * 40
    const attachmentsBoost = attachmentsCount > 0 ? 42 : 0
    const previewBoost = preview ? 24 : 0

    return baseHeight + textBoost + partBoost + nestedBoost + attachmentsBoost + previewBoost
}

export function LazyStepRow({
    step,
    index,
    eager,
    isNarrow,
    preview,
    onMeasureRef,
    children,
}: Props) {
    const shellRef = React.useRef<HTMLDivElement | null>(null)
    const [mounted, setMounted] = React.useState(eager)

    React.useEffect(() => {
        if (eager) setMounted(true)
    }, [eager])

    React.useEffect(() => {
        if (mounted) return

        const element = shellRef.current
        if (!element) return

        if (typeof IntersectionObserver === 'undefined') {
            setMounted(true)
            return
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
                    setMounted(true)
                    observer.disconnect()
                }
            },
            { rootMargin: VIEWPORT_ROOT_MARGIN }
        )

        observer.observe(element)
        return () => observer.disconnect()
    }, [mounted])

    const estimatedHeight = React.useMemo(
        () => estimateStepCardHeight(step, preview, isNarrow),
        [isNarrow, preview, step]
    )

    return (
        <div
            ref={(element) => {
                shellRef.current = element
                onMeasureRef?.(element)
            }}
        >
            {mounted ? children : (
                <div className="step-card step-card--placeholder" style={{ minHeight: estimatedHeight }}>
                    <div className="step-header">
                        <div className="step-title-wrap">
                            <div className="step-title">#{index + 1}</div>
                            <div className="step-meta">
                                <span className="step-chip step-chip-placeholder">...</span>
                            </div>
                        </div>
                    </div>
                    <div className="step-placeholder-body" />
                </div>
            )}
        </div>
    )
}
