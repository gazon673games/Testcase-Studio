// @providers/mappers.ts
import { v4 as uuid } from 'uuid'
import type { Attachment, Step, TestCase, TestMeta } from '@core/domain'
import type { ProviderTest, ProviderStep } from '@providers/types'
import type { ExportTest, ExportStep } from '@core/export'

/** ProviderTest -> наш доменный TestCase (для pull) */
export function fromProviderPayload(
    src: ProviderTest
): Pick<TestCase, 'name' | 'description' | 'steps' | 'attachments' | 'updatedAt' | 'meta'> {
    return {
        name: src.name ?? '',
        description: src.description ?? '',
        steps: mapProviderSteps(src.steps ?? []),
        attachments: (src.attachments ?? []).map(copyAttachment),
        updatedAt: src.updatedAt ?? new Date().toISOString(),
        meta: { tags: [], params: {} } as TestMeta,
    }
}

/** Наш TestCase ИЛИ ExportTest -> ProviderTest (для push) */
type Domainish = Pick<TestCase, 'id' | 'name' | 'description' | 'steps' | 'attachments' | 'meta'>

/** Перегрузки для удобства типов */
export function toProviderPayload(test: Domainish): ProviderTest
export function toProviderPayload(test: ExportTest): ProviderTest
export function toProviderPayload(test: Domainish | ExportTest): ProviderTest {
    const id = (test as any).id
    const name = test.name
    const description = (test as any).description ?? ''
    const attachments = (test as any).attachments ?? []

    const stepsArray: Array<Step | ExportStep> = (test as any).steps ?? []
    const providerSteps = normalizeStepsForProvider(stepsArray)

    return {
        id: id ?? String(Math.random()),
        name,
        description,
        steps: providerSteps,
        attachments: attachments.map(copyAttachment),
        updatedAt: new Date().toISOString(),
    }
}

/* ───────── helpers ───────── */

function mapProviderSteps(src: ProviderStep[]): Step[] {
    return (src ?? []).map(ps => ({
        id: uuid(),                                // обязательный id для React/редактора
        action: safeStr(ps.action),
        data: safeStr(ps.data),
        expected: safeStr(ps.expected),
        text: safeStr(ps.text ?? ps.action),
        subSteps: [],
        internal: { parts: { action: [], data: [], expected: [] } },
        attachments: [],
    }))
}

/** Унифицируем шаги из Domain Step[] или ExportStep[] в ProviderStep[] */
function normalizeStepsForProvider(src: Array<Step | ExportStep>): ProviderStep[] {
    return (src ?? []).map(s => {
        // у доменного Step есть id/ text / internal и т.п.
        const isDomain = 'id' in (s as any)
        if (isDomain) {
            const ds = s as Step
            return {
                action: safeStr(ds.action ?? ds.text),
                data: safeStr(ds.data),
                expected: safeStr(ds.expected),
                text: safeStr(ds.text),
            }
        } else {
            const es = s as ExportStep
            return {
                action: safeStr(es.action),
                data: safeStr(es.data),
                expected: safeStr(es.expected),
                text: '', // в ExportStep нет text — оставляем пустым
            }
        }
    })
}

function copyAttachment(a: Attachment): Attachment {
    return { id: a.id, name: a.name, pathOrDataUrl: a.pathOrDataUrl }
}

function safeStr(x: unknown): string {
    return x == null ? '' : String(x)
}
