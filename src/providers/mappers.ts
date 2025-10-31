// src/providers/mappers.ts
import { v4 as uuid } from 'uuid'
import type { Attachment, Step, TestCase, TestMeta } from '@core/domain'
import type { ProviderTest, ProviderStep } from '@providers/types'
import type { ExportTest, ExportStep } from '@core/export'

export function fromProviderPayload(
    src: ProviderTest
): Pick<TestCase, 'name' | 'description' | 'steps' | 'attachments' | 'updatedAt' | 'meta'> {
    // базовые поля
    const name = src.name ?? ''
    const description = src.description ?? ''
    const steps = mapProviderSteps(src.steps ?? [])
    const attachments = (src.attachments ?? []).map(copyAttachment)
    const updatedAt = src.updatedAt ?? new Date().toISOString()

    // ✨ раскладываем extras в params
    const params: Record<string, string> = {}

    const put = (k: string, v: unknown) => {
        if (v === undefined || v === null) return
        if (Array.isArray(v) || typeof v === 'object') {
            // сложные типы → JSON
            params[k] = JSON.stringify(v)
        } else {
            params[k] = String(v)
        }
    }

    const ex = src.extras ?? {}
    // верхнеуровневые простые поля
    put('key',            (ex as any).key)
    put('keyNumber',      (ex as any).keyNumber)
    put('status',         (ex as any).status)
    put('priority',       (ex as any).priority)
    put('component',      (ex as any).component)
    put('projectKey',     (ex as any).projectKey)
    put('folder',         (ex as any).folder)
    put('latestVersion',  (ex as any).latestVersion)
    put('lastTestResultStatus', (ex as any).lastTestResultStatus)
    put('owner',          (ex as any).owner)
    put('updatedBy',      (ex as any).updatedBy)
    put('createdBy',      (ex as any).createdBy)
    put('createdOn',      (ex as any).createdOn)
    put('updatedOn',      (ex as any).updatedOn)
    put('issueLinks',     (ex as any).issueLinks) // массив → JSON

    // customFields: объект → каждое поле отдельным ключом
    const cf = (ex as any).customFields as Record<string, unknown> | undefined
    if (cf && typeof cf === 'object') {
        for (const [k, v] of Object.entries(cf)) put(`customFields.${k}`, v)
    }

    // parameters: объект с массивами → сериализуем оба массива
    const par = (ex as any).parameters as { variables?: unknown[]; entries?: unknown[] } | undefined
    if (par && typeof par === 'object') {
        if ('variables' in par) put('parameters.variables', par.variables ?? [])
        if ('entries'   in par) put('parameters.entries',   par.entries  ?? [])
    }

    const meta: TestMeta = { tags: [], params }

    return { name, description, steps, attachments, updatedAt, meta }
}

/* остальное — как было */
export function toProviderPayload(test: Pick<TestCase, 'id' | 'name' | 'description' | 'steps' | 'attachments' | 'meta'> | ExportTest): ProviderTest {
    const id = (test as any).id
    const name = test.name
    const description = (test as any).description ?? ''
    const attachments = (test as any).attachments ?? []
    const stepsArray: Array<Step | ExportStep> = (test as any).steps ?? []
    const providerSteps = normalizeStepsForProvider(stepsArray)
    return { id: id ?? String(Math.random()), name, description, steps: providerSteps, attachments: attachments.map(copyAttachment), updatedAt: new Date().toISOString() }
}

function mapProviderSteps(src: ProviderStep[]): Step[] {
    return (src ?? []).map(ps => ({
        id: uuid(),
        action: safeStr(ps.action),
        data: safeStr(ps.data),
        expected: safeStr(ps.expected),
        text: safeStr(ps.text ?? ps.action),
        subSteps: [],
        internal: { parts: { action: [], data: [], expected: [] } },
        attachments: [],
    }))
}

function normalizeStepsForProvider(src: Array<Step | ExportStep>): ProviderStep[] {
    return (src ?? []).map(s => {
        const isDomain = 'id' in (s as any)
        if (isDomain) {
            const ds = s as Step
            return { action: safeStr(ds.action ?? ds.text), data: safeStr(ds.data), expected: safeStr(ds.expected), text: safeStr(ds.text) }
        } else {
            const es = s as ExportStep
            return { action: safeStr(es.action), data: safeStr(es.data), expected: safeStr(es.expected), text: '' }
        }
    })
}

function copyAttachment(a: Attachment): Attachment { return { id: a.id, name: a.name, pathOrDataUrl: a.pathOrDataUrl } }
function safeStr(x: unknown): string { return x == null ? '' : String(x) }
