// src/providers/zephyr.http.ts
import type { ITestProvider, ProviderTest, ProviderStep } from './types'
import { apiClient } from '@ipc/client'

type ZephyrTestCaseResponse = {
    key?: string
    name?: string
    description?: string | null
    updatedOn?: string
    owner?: string
    updatedBy?: string
    createdBy?: string
    createdOn?: string
    keyNumber?: number
    priority?: string
    component?: string
    projectKey?: string
    objective?: string | null
    precondition?: string | null
    folder?: string
    latestVersion?: boolean
    lastTestResultStatus?: string
    status?: string
    issueLinks?: string[]
    customFields?: Record<string, unknown>
    parameters?: { variables?: unknown[]; entries?: unknown[] }
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
    if (/^\d+$/.test(t)) return { by: 'id', ref: t }  // только цифры → ID
    if (/-/.test(t))   return { by: 'key', ref: t }   // есть дефис → KEY
    return { by: 'key', ref: t }
}

export class ZephyrHttpProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const { by, ref } = parseRef(externalId)
        // ⚠️ CORS обходим через IPC в main
        const json = (await apiClient.zephyrGetTestCase(ref, by)) as ZephyrTestCaseResponse

        const steps: ProviderStep[] = (json.testScript?.steps ?? [])
            .filter((s) => s && (s.description || s.testData || s.expectedResult))
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((s) => ({
                action:   String(s.description ?? ''),
                data:     String(s.testData ?? ''),
                expected: String(s.expectedResult ?? ''),
                text:     String(s.description ?? ''),
            }))

        // ✨ Собираем extras — всё, что нужно разложить в meta.params
        const extras: Record<string, unknown> = {
            key: json.key,
            keyNumber: json.keyNumber,
            status: json.status,
            priority: json.priority,
            component: json.component,
            projectKey: json.projectKey,
            folder: json.folder,
            latestVersion: json.latestVersion,
            lastTestResultStatus: json.lastTestResultStatus,
            owner: json.owner,
            updatedBy: json.updatedBy,
            createdBy: json.createdBy,
            createdOn: json.createdOn,
            updatedOn: json.updatedOn,
            issueLinks: json.issueLinks ?? [],
            customFields: json.customFields ?? {},
            parameters: json.parameters ?? { variables: [], entries: [] },
            objective: json.objective ?? null,
            preconditions: json.precondition ?? null,
        }

        return {
            id: json.key || ref,
            name: String(json.name ?? (json.key || ref)),
            description: json.description ?? undefined,
            steps,
            attachments: [],
            updatedAt: json.updatedOn ?? new Date().toISOString(),
            extras, // ← NEW
        }
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        return { externalId: payload.id || '' }
    }
    async attach() {}
    async deleteAttachment() {}
}
