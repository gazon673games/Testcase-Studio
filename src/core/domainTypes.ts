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
    integration?: Record<string, unknown>
    usesShared?: SharedStepID
    attachments?: Attachment[]
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
}

export interface TestCaseLink {
    provider: ProviderKind
    externalId: string
}

export interface ExportConfig {
    enabled: boolean
}

/**
 * @aggregate root for individual test cases.
 * Owns its steps, attachments, links and metadata.
 * Mutations must go through workspace commands, not direct property writes.
 */
export interface TestCase {
    id: ID
    name: string
    description?: string
    steps: Step[]
    attachments: Attachment[]
    links: TestCaseLink[]
    updatedAt: string
    details?: TestDetails
    integration?: Record<string, unknown>
    exportCfg?: ExportConfig
}

/**
 * @aggregate root for the workspace tree.
 * Contains child Folders and TestCases; the top-level root Folder is the
 * entry point for all tree navigation and structural mutations.
 */
export interface Folder {
    id: ID
    name: string
    iconKey?: string
    alias?: string
    children: Array<Folder | TestCase>
}

/**
 * @aggregate root for reusable step libraries.
 * A SharedStep is referenced by TestCase steps via `usesShared`.
 * Deleting a SharedStep cascades removal of all referencing steps.
 */
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
export type StepRaw = StepSnapshot
export type TestMeta = TestDetails
