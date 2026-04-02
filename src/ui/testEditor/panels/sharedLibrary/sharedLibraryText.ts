import type { Step } from '@core/domain'
import type { ResolvedWikiRef } from '@core/refs'

export function collectStepTexts(steps: Step[]) {
    return steps
        .flatMap((step) => [
            step.action,
            step.data,
            step.expected,
            step.text,
            ...(step.internal?.parts?.action?.map((part) => part.text) ?? []),
            ...(step.internal?.parts?.data?.map((part) => part.text) ?? []),
            ...(step.internal?.parts?.expected?.map((part) => part.text) ?? []),
        ])
        .filter((value): value is string => Boolean(value))
}

export function flattenStepText(steps: Step[]) {
    return collectStepTexts(steps).join(' \n ')
}

export function countBrokenRefs(steps: Step[], inspectRefs: (src: string) => ResolvedWikiRef[]) {
    let total = 0
    for (const text of collectStepTexts(steps)) {
        if (!text) continue
        total += inspectRefs(text).filter((ref) => !ref.ok).length
    }
    return total
}

export function makeSharedPreview(steps: Step[]) {
    return steps
        .slice(0, 2)
        .map((step) => String(step.action || step.text || step.expected || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' вЂў ')
}
