// @core/export.ts
import type {
    Attachment,
    PartItem,
    RootState,
    Step,
    TestCase,
    TestMeta,
} from './domain'
import { materializeSharedSteps } from './shared'

/** Экспортируемая форма одного шага */
export type ExportStep = {
    action?: string
    data?: string
    expected?: string
    /** 🆕 Вложения шага (берём и из step.attachments, и из internal.meta.attachments) */
    attachments?: Attachment[]
}

/** Экспортируемая форма теста */
export type ExportTest = {
    id: string
    name: string
    description?: string
    steps: ExportStep[]
    /** Вложения уровня теста (как было) */
    attachments: Attachment[]
    meta?: TestMeta
}

/* ────────────────────────────────────────────────────────── */
/* helpers */

function pickColumn(s: Step, kind: 'action' | 'data' | 'expected') {
    const parts: PartItem[] | undefined = s.internal?.parts?.[kind]
    if (parts && parts.length > 0) {
        // Склеиваем все части через перенос строки
        const joined = parts.map(p => p.text ?? '').join('\n').trim()
        return joined || undefined
    }
    // Fallback: топ-уровень, для action ещё учитываем s.text
    const top = (s as any)[kind] ?? (kind === 'action' ? s.text : undefined)
    const val = (top ?? '').toString().trim()
    return val || undefined
}

/** Собираем вложения шага из нового и старого мест */
function collectStepAttachments(s: Step): Attachment[] {
    const fromNew = Array.isArray(s.attachments) ? s.attachments : []
    const legacy = (s.internal as any)?.meta?.attachments
    const fromLegacy = Array.isArray(legacy) ? legacy : []
    // Уберём возможные дубликаты по id
    const map = new Map<string, Attachment>()
    for (const a of [...fromLegacy, ...fromNew]) {
        if (a && a.id) map.set(a.id, a)
    }
    return [...map.values()]
}

/* ────────────────────────────────────────────────────────── */
/* экспорт шага/теста */

function exportOneStep(s: Step): ExportStep {
    return {
        action: pickColumn(s, 'action'),
        data: pickColumn(s, 'data'),
        expected: pickColumn(s, 'expected'),
        attachments: collectStepAttachments(s),
    }
}

/**
 * Построить «канонический экспорт» для теста
 * с разворотом shared-steps (если есть RootState)
 */
export function buildExport(test: TestCase, state?: RootState): ExportTest {
    const steps = state ? materializeSharedSteps(test.steps, state.sharedSteps) : test.steps
    return {
        id: test.id,
        name: test.name,
        description: test.description,
        steps: steps.map(exportOneStep),
        attachments: test.attachments,
        meta: test.meta,
    }
}
