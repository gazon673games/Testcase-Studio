import type { Attachment, Step } from '@core/domain'

export interface ProviderTest {
    id: string
    name: string
    description?: string
    steps: Step[]               // достаточно action/data/expected/text
    attachments: Attachment[]
    updatedAt?: string
}

export interface PullOptions { includeAttachments?: boolean }
export interface PushOptions { pushAttachments?: boolean }

export interface ITestProvider {
    getTestDetails(externalId: string, opts: PullOptions): Promise<ProviderTest>
    upsertTest(payload: ProviderTest, opts: PushOptions): Promise<{ externalId: string }>
    attach(externalId: string, attachment: Attachment): Promise<void>
    deleteAttachment(externalId: string, attachmentId: string): Promise<void>
}
