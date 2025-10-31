// providers/types.ts
import type { Attachment, Step } from '@core/domain'

export type ProviderStep = Pick<Step, 'action' | 'data' | 'expected' | 'text'>

export interface ProviderTest {
    id: string
    name: string
    description?: string
    steps: ProviderStep[]
    attachments: Attachment[]
    updatedAt?: string
    extras?: Record<string, unknown> // ← NEW
}

export interface PullOptions { includeAttachments?: boolean }
export interface PushOptions { pushAttachments?: boolean }

export interface ITestProvider {
    getTestDetails(externalId: string, opts?: PullOptions): Promise<ProviderTest>
    upsertTest(payload: ProviderTest, opts?: PushOptions): Promise<{ externalId: string }>
    attach(externalId: string, attachment: Attachment): Promise<void>
    deleteAttachment(externalId: string, attachmentId: string): Promise<void>
}