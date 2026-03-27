import type {
    Attachment,
    PartItem,
    RootState,
    Step,
    TestCase,
    TestMeta,
} from './domain'
import { buildRefCatalog, renderRefsInText, type RefCatalog } from './refs'
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
    meta?: TestMeta
}

function createTextResolver(catalog?: RefCatalog) {
    return (value: string | undefined) => {
        if (!value) return undefined
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
    const parts: PartItem[] | undefined = step.internal?.parts?.[kind]
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
    const legacy = Array.isArray((step.internal as any)?.meta?.attachments) ? (step.internal as any).meta.attachments : []

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

function resolveMeta(meta: TestMeta | undefined, resolveText: (value: string | undefined) => string | undefined) {
    if (!meta) return undefined

    return {
        ...meta,
        objective: resolveText(meta.objective),
        preconditions: resolveText(meta.preconditions),
        params: meta.params
            ? Object.fromEntries(
                  Object.entries(meta.params).map(([key, value]) => [
                      key,
                      typeof value === 'string' ? resolveText(value) ?? '' : value,
                  ])
              )
            : meta.params,
    }
}

export function buildExport(test: TestCase, state?: RootState): ExportTest {
    const steps = state ? materializeSharedSteps(test.steps, state.sharedSteps) : test.steps
    const catalog = state ? buildRefCatalog(mapTests(state.root), state.sharedSteps) : undefined
    const resolveText = createTextResolver(catalog)

    return {
        id: test.id,
        name: test.name,
        description: resolveText(test.description),
        steps: steps.map((step) => exportOneStep(step, resolveText)),
        attachments: test.attachments,
        meta: resolveMeta(test.meta, resolveText),
    }
}
