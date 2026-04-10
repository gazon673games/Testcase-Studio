import type { Attachment, Step } from '@core/domain'

export type ProviderStep = Pick<Step, 'action' | 'data' | 'expected' | 'text'> & {
    providerStepId?: string
    testCaseKey?: string
    includedTest?: ProviderTest
    attachments?: Attachment[]
}

export interface ProviderTestParameters {
    variables?: unknown[]
    entries?: unknown[]
}

export interface ProviderTestExtras {
    key?: string
    keyNumber?: string | number
    status?: string
    priority?: string
    component?: string
    projectKey?: string
    folder?: string
    latestVersion?: boolean
    lastTestResultStatus?: string
    owner?: string
    updatedBy?: string
    createdBy?: string
    createdOn?: string
    updatedOn?: string
    issueLinks?: unknown[]
    objective?: string
    preconditions?: string
    customFields?: Record<string, unknown>
    parameters?: ProviderTestParameters
    __parametersMode?: unknown
    [key: string]: unknown
}

export interface ProviderTestRef {
    ref: string
    key?: string
    name?: string
    folder?: string
    projectKey?: string
    updatedAt?: string
}

export interface ProviderTest {
    id: string
    name: string
    description?: string
    steps: ProviderStep[]
    attachments: Attachment[]
    updatedAt?: string
    extras?: ProviderTestExtras
}

export interface PullOptions { includeAttachments?: boolean }
export interface PushOptions { pushAttachments?: boolean }
export interface SearchOptions {
    maxResults?: number
    startAt?: number
}

export interface ITestProvider {
    getTestDetails(externalId: string, opts?: PullOptions): Promise<ProviderTest>
    upsertTest(payload: ProviderTest, opts?: PushOptions): Promise<{ externalId: string }>
    attach(externalId: string, attachment: Attachment): Promise<void>
    deleteAttachment(externalId: string, attachmentId: string): Promise<void>
    searchTestsByQuery?(query: string, opts?: SearchOptions): Promise<ProviderTestRef[]>
}
