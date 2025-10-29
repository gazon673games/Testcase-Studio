import type { Attachment, PartItem, RootState, Step, TestCase, TestMeta } from './domain'
import { materializeSharedSteps } from './shared'

export type ExportStep = { action?: string; data?: string; expected?: string }
export type ExportTest = {
    id: string
    name: string
    description?: string
    steps: ExportStep[]
    attachments: Attachment[]
    meta?: TestMeta
}

/**
 * Политика экспорта шага:
 * - если есть parts — склеиваем их по \n
 * - иначе берём top-level поля (action/data/expected) или text для совместимости
 */
function exportOneStep(s: Step): ExportStep {
    const pick = (kind: 'action' | 'data' | 'expected') => {
        const parts: PartItem[] | undefined = s.internal?.parts?.[kind]
        if (parts && parts.length > 0) {
            // экспортируем все parts, склеивая их через перевод строки
            return parts.map(p => p.text ?? '').join('\n').trim() || undefined
        }

        // иначе fallback на поля шага
        const top = (s as any)[kind] ?? (kind === 'action' ? s.text : undefined)
        return (top ?? '').toString() || undefined
    }

    return {
        action: pick('action'),
        data: pick('data'),
        expected: pick('expected'),
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
