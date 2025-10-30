// providers/types.ts
import type { Attachment, Step } from '@core/domain'

/** Шаг, который возвращает провайдер: без наших id/внутренностей */
export type ProviderStep = Pick<Step, 'action' | 'data' | 'expected' | 'text'>

/** Унифицированная форма теста от провайдера */
export interface ProviderTest {
    id: string
    name: string
    description?: string
    steps: ProviderStep[]
    attachments: Attachment[]
    updatedAt?: string
}

export interface PullOptions { includeAttachments?: boolean }
export interface PushOptions { pushAttachments?: boolean }

export interface ITestProvider {
    getTestDetails(externalId: string, opts?: PullOptions): Promise<ProviderTest>
    upsertTest(payload: ProviderTest, opts?: PushOptions): Promise<{ externalId: string }>
    attach(externalId: string, attachment: Attachment): Promise<void>
    deleteAttachment(externalId: string, attachmentId: string): Promise<void>
}
