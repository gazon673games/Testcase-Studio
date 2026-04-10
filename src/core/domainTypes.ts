export type ProviderKind = 'zephyr' | 'allure'
export type ID = string
export type SharedStepID = string

export interface Attachment {
    id: ID
    name: string
    pathOrDataUrl: string
}

export interface StepBlock {
    id: ID
    text: string
    export?: boolean
}

export interface StepPresentation {
    note?: string
    url?: string
    meta?: Record<string, unknown>
    parts?: {
        action?: StepBlock[]
        data?: StepBlock[]
        expected?: StepBlock[]
    }
}

export interface SubStep {
    id: ID
    title?: string
    text?: string
}

export interface ImportedStepSource {
    sourceStepId?: string
    includedCaseRef?: string
}

export interface StepSnapshot {
    action?: string
    data?: string
    expected?: string
}

export interface Step {
    id: ID
    action?: string
    data?: string
    expected?: string
    text?: string
    snapshot?: StepSnapshot
    source?: ImportedStepSource
    subSteps?: SubStep[]
    presentation?: StepPresentation
    usesShared?: SharedStepID
    attachments?: Attachment[]
    raw?: StepSnapshot
    internal?: StepPresentation
}

export interface PublicationDetails {
    type?: string
    automation?: string
    assignedTo?: string
}

export interface ExternalParameterCatalog {
    variables?: unknown[]
    entries?: unknown[]
}

export interface ExternalSystemDetails {
    key?: string
    keyNumber?: string
    projectKey?: string
    latestVersion?: boolean
    lastTestResultStatus?: string
    updatedBy?: string
    createdBy?: string
    createdOn?: string
    updatedOn?: string
    issueLinks?: string[]
    customFields?: Record<string, unknown>
    parameters?: ExternalParameterCatalog
}

export interface TestDetails {
    attributes?: Record<string, string>
    tags: string[]
    objective?: string
    preconditions?: string
    status?: string
    priority?: string
    component?: string
    owner?: string
    folder?: string
    estimated?: string
    publication?: PublicationDetails
    external?: ExternalSystemDetails
    params?: Record<string, string>
}

export interface TestCaseLink {
    provider: ProviderKind
    externalId: string
}

export interface ExportConfig {
    enabled: boolean
}

export interface TestCase {
    id: ID
    name: string
    description?: string
    steps: Step[]
    attachments: Attachment[]
    links: TestCaseLink[]
    updatedAt: string
    details?: TestDetails
    exportCfg?: ExportConfig
    meta?: TestDetails
}

export interface Folder {
    id: ID
    name: string
    iconKey?: string
    alias?: string
    children: Array<Folder | TestCase>
}

export interface SharedStep {
    id: SharedStepID
    name: string
    steps: Step[]
    updatedAt: string
}

export interface RootState {
    root: Folder
    sharedSteps: SharedStep[]
}

export type PartItem = StepBlock
export type StepInternal = StepPresentation
export type StepSource = ImportedStepSource
export type StepRaw = StepSnapshot
export type TestPublication = PublicationDetails
export type TestExternalParameters = ExternalParameterCatalog
export type TestExternalMeta = ExternalSystemDetails
export type TestMeta = TestDetails
