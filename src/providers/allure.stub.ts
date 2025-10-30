// providers/allure.stub.ts
import type { ITestProvider, ProviderTest } from './types'

/**
 * Минимальный стаб Allure: возвращает ProviderTest.
 */
export class AllureStubProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        return {
            id: externalId,
            name: `Allure Test #${externalId}`,
            description: 'Fetched from Allure stub',
            steps: [
                { action: 'Open page', data: 'https://example.com', expected: 'Page is visible' },
                { action: 'Click Login', data: '—', expected: 'Form appears' },
            ],
            attachments: [],
            updatedAt: new Date().toISOString(),
        }
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        return { externalId: String(payload.id || Math.floor(Math.random() * 1e6)) }
    }

    async attach(_externalId: string, _attachment: any): Promise<void> {
        // no-op
    }

    async deleteAttachment(_externalId: string, _attachmentId: string): Promise<void> {
        // no-op
    }
}
