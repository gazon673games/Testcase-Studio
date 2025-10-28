// src/providers/mappers.ts
import type { ExportTest } from '@core/export'
import type { ProviderTest } from './types'

/** Zephyr и Allure сейчас принимают схожие поля — отдаём общий ProviderTest */
export function toProviderPayload(x: ExportTest): ProviderTest {
    return {
        id: x.id,                        // провайдер может заменить id на свой при upsert
        name: x.name,
        description: x.description,
        steps: x.steps.map((s, i) => ({
            id: `${i+1}`,                  // провайдеры часто сами генерят id; даём стабильные псевдо-id
            action: s.action,
            data: s.data,
            expected: s.expected,
            text: s.action ?? undefined,   // совместимость со старым UI
        })),
        attachments: x.attachments,
        updatedAt: new Date().toISOString()
    }
}

/** Обратное преобразование (naive): ProviderTest -> частичный локальный TestCase */
export function fromProviderPayload(p: ProviderTest) {
    return {
        name: p.name,
        description: p.description,
        steps: p.steps?.map(s => ({
            id: cryptoRandomId(),
            action: s.action ?? s.text ?? '',
            data: s.data ?? '',
            expected: s.expected ?? '',
            text: s.action ?? s.text ?? '',
            subSteps: [],
            internal: { parts: { action: [], data: [], expected: [] } }
        })) ?? [],
        attachments: p.attachments ?? [],
        updatedAt: p.updatedAt ?? new Date().toISOString()
    }
}

function cryptoRandomId() {
    // в main/renderer доступен crypto.randomUUID, но этот helper держим здесь на всякий
    try { return (globalThis as any).crypto?.randomUUID?.() ?? String(Math.random()).slice(2) }
    catch { return String(Math.random()).slice(2) }
}
