export type ZephyrAttachmentResponse = Record<string, unknown>

export type ZephyrTestCaseResponse = {
    key?: string
    name?: string
    description?: string | null
    labels?: string[]
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
            attachments?: ZephyrAttachmentResponse[]
        }>
    }
    attachments?: ZephyrAttachmentResponse[]
}
