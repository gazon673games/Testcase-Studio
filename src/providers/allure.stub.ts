import type { ITestProvider, ProviderTest } from './types'
import type { Attachment, TestCase } from '@core/domain'

export class AllureStubProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        return { id: externalId, name: 'Allure Stub Test', steps: [], attachments: [] }
    }
    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        return { externalId: `allure-${payload.id}` }
    }
    async attach(_externalId: string, _attachment: Attachment): Promise<void> {
        console.warn('[AllureStub] attach noop')
    }
    async deleteAttachment(_externalId: string, _attachmentId: string): Promise<void> {
        console.warn('[AllureStub] deleteAttachment noop')
    }
}
