type StepLike = {
    action?: string
    data?: string
    expected?: string
    text?: string
}

export interface PreviewStepDiffEntry {
    summary: string
    action: string
    data: string
    expected: string
}

export interface PreviewStepDiffRow {
    index: number
    local?: PreviewStepDiffEntry
    remote?: PreviewStepDiffEntry
    changed: boolean
}

export function buildPreviewStepDiffRows(
    localSteps: readonly StepLike[] = [],
    remoteSteps: readonly StepLike[] = []
): PreviewStepDiffRow[] {
    const max = Math.max(localSteps.length, remoteSteps.length)
    const rows: PreviewStepDiffRow[] = []

    for (let index = 0; index < max; index += 1) {
        const local = normalizeStepEntry(localSteps[index])
        const remote = normalizeStepEntry(remoteSteps[index])
        rows.push({
            index: index + 1,
            local,
            remote,
            changed: serializeStepEntry(local) !== serializeStepEntry(remote),
        })
    }

    return rows
}

export function summarizePreviewSteps(steps: readonly StepLike[] = []): string {
    if (!steps.length) return '0 steps'
    return `${steps.length} step${steps.length === 1 ? '' : 's'}`
}

export function summarizePreviewText(value: string | undefined, limit = 160): string {
    const text = String(value ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (!text) return 'Empty'
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}

function normalizeStepEntry(step: StepLike | undefined): PreviewStepDiffEntry | undefined {
    if (!step) return undefined
    return {
        summary: summarizePreviewText(step.action || step.text || 'Empty step', 90),
        action: summarizePreviewText(step.action || step.text || '', 220),
        data: summarizePreviewText(step.data, 220),
        expected: summarizePreviewText(step.expected, 220),
    }
}

function serializeStepEntry(entry: PreviewStepDiffEntry | undefined): string {
    return JSON.stringify(entry ?? null)
}
