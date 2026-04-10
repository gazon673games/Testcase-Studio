import type {
    Attachment,
    StepBlock,
    RootState,
    Step,
    TestCase,
    TestDetails,
} from './domain'
import { buildRefCatalog, formatResolvedRefBrokenReason, inspectWikiRefs, renderRefsInText, type RefCatalog, type ResolvedWikiRef } from './refs'
import { materializeSharedSteps } from './shared'
import { mapTests } from './tree'

export type ExportStep = {
    action?: string
    data?: string
    expected?: string
    attachments?: Attachment[]
}

export type ExportTest = {
    id: string
    name: string
    description?: string
    steps: ExportStep[]
    attachments: Attachment[]
    details?: TestDetails
}

export class ExportIntegrityError extends Error {
    issues: ResolvedWikiRef[]

    constructor(message: string, issues: ResolvedWikiRef[]) {
        super(message)
        this.name = 'ExportIntegrityError'
        this.issues = issues
    }
}

function createTextResolver(catalog?: RefCatalog) {
    return (value: string | undefined) => {
        if (!value) return undefined
        if (catalog) {
            const issues = inspectWikiRefs(value, catalog).filter((ref) => !ref.ok)
            if (issues.length > 0) {
                throw new ExportIntegrityError(buildBrokenRefsMessage(issues), issues)
            }
        }
        const resolved = catalog ? renderRefsInText(value, catalog, { mode: 'plain' }) : value
        const trimmed = resolved.trim()
        return trimmed || undefined
    }
}

function pickColumn(
    step: Step,
    kind: 'action' | 'data' | 'expected',
    resolveText: (value: string | undefined) => string | undefined
) {
    const parts: StepBlock[] | undefined = step.presentation?.parts?.[kind]
    if (parts?.length) {
        const exportableParts = parts.filter((part) => part.export !== false)
        const topLevel = kind === 'action' ? step.action ?? step.text ?? '' : ((step as any)[kind] ?? '')
        const chunks = [
            String(topLevel ?? '').trim(),
            ...exportableParts.map((part) => String(part.text ?? '').trim()),
        ].filter(Boolean)
        const joined = chunks.join('\n').trim()
        return resolveText(joined || undefined)
    }

    const topLevel = (step as any)[kind] ?? (kind === 'action' ? step.text : undefined)
    const value = String(topLevel ?? '').trim()
    return resolveText(value || undefined)
}

function collectStepAttachments(step: Step): Attachment[] {
    const next = new Map<string, Attachment>()
    const modern = Array.isArray(step.attachments) ? step.attachments : []
    const legacy =
        Array.isArray((step.presentation as any)?.meta?.attachments)
            ? (step.presentation as any).meta.attachments
            : []

    for (const attachment of [...legacy, ...modern]) {
        if (attachment?.id) next.set(attachment.id, attachment)
    }

    return [...next.values()]
}

function exportOneStep(step: Step, resolveText: (value: string | undefined) => string | undefined): ExportStep {
    return {
        action: pickColumn(step, 'action', resolveText),
        data: pickColumn(step, 'data', resolveText),
        expected: pickColumn(step, 'expected', resolveText),
        attachments: collectStepAttachments(step),
    }
}

function resolveDetails(details: TestDetails | undefined, resolveText: (value: string | undefined) => string | undefined) {
    if (!details) return undefined

    return {
        ...details,
        objective: resolveText(details.objective),
        preconditions: resolveText(details.preconditions),
        attributes: details.attributes
            ? Object.fromEntries(
                  Object.entries(details.attributes).map(([key, value]) => [
                      key,
                      typeof value === 'string' ? resolveText(value) ?? '' : value,
                  ])
              )
            : details.attributes,
    }
}

export function buildExport(test: TestCase, state?: RootState): ExportTest {
    const steps = state ? materializeSharedSteps(test.steps, state.sharedSteps) : test.steps
    const catalog = state ? buildRefCatalog(mapTests(state.root), state.sharedSteps) : undefined
    const resolveText = createTextResolver(catalog)

    const details = resolveDetails(test.details, resolveText)

    return {
        id: test.id,
        name: test.name,
        description: resolveText(test.description),
        steps: steps.map((step) => exportOneStep(step, resolveText)),
        attachments: test.attachments,
        details,
    }
}

function buildBrokenRefsMessage(issues: ResolvedWikiRef[]) {
    const first = issues[0]
    const reason = formatResolvedRefBrokenReason(first, (key) => {
        switch (key) {
            case 'refs.broken.sourceAmbiguous':
                return 'Source name is ambiguous'
            case 'refs.broken.sourceMissing':
                return 'Source not found'
            case 'refs.broken.stepMissing':
                return 'Step not found'
            case 'refs.broken.partMissing':
                return 'Block not found'
            case 'refs.broken.fieldEmpty':
                return 'Referenced field is empty'
            case 'refs.broken.cycleDetected':
                return 'Reference cycle detected'
            default:
                return 'Invalid reference'
        }
    })
    return `Export blocked by broken refs: ${reason}${issues.length > 1 ? ` (+${issues.length - 1})` : ''}`
}
