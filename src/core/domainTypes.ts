export type ProviderKind = 'zephyr' | 'allure'
export type ID = string
export type SharedStepID = string

export interface Attachment {
    id: ID
    name: string
    pathOrDataUrl: string
}

export interface PartItem {
    id: ID
    text: string
    export?: boolean
}

export interface StepInternal {
    note?: string
    url?: string
    meta?: Record<string, unknown>
    parts?: {
        action?: PartItem[]
        data?: PartItem[]
        expected?: PartItem[]
    }
}

export interface SubStep {
    id: ID
    title?: string
    text?: string
}

export interface StepRaw {
    action?: string
    data?: string
    expected?: string
    providerStepId?: string
    testCaseKey?: string
}

export interface Step {
    id: ID
    action?: string
    data?: string
    expected?: string
    text?: string
    raw?: StepRaw
    subSteps?: SubStep[]
    internal?: StepInternal
    usesShared?: SharedStepID
    attachments?: Attachment[]
}

export interface TestMeta {
    params?: Record<string, string>
    tags: string[]
    objective?: string
    preconditions?: string
    status?: string
    priority?: string
    component?: string
    owner?: string
    folder?: string
    estimated?: string
    testType?: string
    automation?: string
    assignedTo?: string
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
    meta?: TestMeta
    exportCfg?: ExportConfig
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
