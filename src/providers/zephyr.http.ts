// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderStep } from './types'
import { apiClient } from '@ipc/client'

type ZephyrTestCaseResponse = {
    key?: string
    name?: string
    description?: string | null
    updatedOn?: string
    testScript?: {
        type?: string
        steps?: Array<{
            id?: number | string
            index?: number
            description?: string | null
            testData?: string | null
            expectedResult?: string | null
            testCaseKey?: string | null
        }>
    }
    attachments?: any[]
}

// разбор ссылки пользователя: ID vs KEY
function parseRef(raw: string): { by: 'id' | 'key'; ref: string } {
    const t = String(raw ?? '').trim()
    if (/^\d+$/.test(t)) return { by: 'id', ref: t }     // только цифры → ID
    if (/-/.test(t)) return { by: 'key', ref: t }        // есть дефис → KEY
    // fallback: считаем ключом (не мутируем регистр)
    return { by: 'key', ref: t }
}

export class ZephyrHttpProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const { by, ref } = parseRef(externalId)

        // ⚠️ вместо fetch из рендера — IPC в main, чтобы не ловить CORS
        const json = (await apiClient.zephyrGetTestCase(ref, by)) as ZephyrTestCaseResponse

        const steps: ProviderStep[] = (json.testScript?.steps ?? [])
            .filter((s) => s && (s.description || s.testData || s.expectedResult))
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((s) => ({
                // НИЧЕГО не чистим: храним HTML как есть
                action: String(s.description ?? ''),
                data: String(s.testData ?? ''),
                expected: String(s.expectedResult ?? ''),
                text: String(s.description ?? ''),
            }))

        return {
            id: json.key || ref, // если пришёл key — используем его; иначе оставим ref
            name: String(json.name ?? (json.key || ref)),
            description: json.description ?? undefined,
            steps,
            attachments: [],
            updatedAt: json.updatedOn ?? new Date().toISOString(),
        }
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        return { externalId: payload.id || '' }
    }
    async attach() {}
    async deleteAttachment() {}
}
