import { v4 as uuid } from 'uuid'

export type ProviderKind = 'zephyr' | 'allure'
export type ID = string
export type SharedStepID = string

/** Элемент «части» внутри одного из столбцов Action/Data/Expected */
export interface PartItem {
    id: ID
    text: string
    /** если true — именно эта часть участвует в экспорте; если false — локальная (неэкспортируемая) */
    export?: boolean
}

/** Неэкспортируемые расширения шага */
export interface StepInternal {
    note?: string
    url?: string
    meta?: Record<string, unknown>
    /** Локальные разбиения каждого столбца на части */
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

export interface Step {
    id: ID

    /** ✅ Экспортируемые плоские поля — все опциональны */
    action?: string
    data?: string
    expected?: string

    /** 🔁 Совместимость со старым UI/моками */
    text?: string

    /** Локальная детализация и служебные поля (в TMS не уходит) */
    subSteps?: SubStep[]
    internal?: StepInternal

    usesShared?: SharedStepID
}

export interface Attachment {
    id: ID
    name: string
    pathOrDataUrl: string
}

export interface TestCaseLink {
    provider: ProviderKind
    externalId: string
}

/** Метаданные теста (параметры и теги) */
export interface TestMeta {
    status?: string
    priority?: string
    component?: string
    owner?: string
    folder?: string
    estimated?: string
    testType?: string
    automation?: string
    assignedTo?: string
    tags: string[]
    /** Markdown поля: */
    objective?: string
    preconditions?: string
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
    /** 🆕 параметры/теги */
    meta?: TestMeta
    exportCfg?: ExportConfig
}

export interface Folder {
    id: ID
    name: string
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

export function nowISO() { return new Date().toISOString() }

export function mkSubStep(title = '', text = ''): SubStep {
    return { id: uuid(), title, text }
}

export function mkStep(action = '', data = '', expected = ''): Step {
    return {
        id: uuid(),
        action,
        data,
        expected,
        text: action || '',
        subSteps: [],
        internal: { parts: { action: [], data: [], expected: [] } }
    }
}

export function mkTest(name: string, description?: string): TestCase {
    return {
        id: uuid(), name, description, steps: [], attachments: [], links: [],
        updatedAt: nowISO(),
        meta: { tags: [] },
        exportCfg: { enabled: true }
    }
}

export function mkFolder(name: string, children: Array<Folder | TestCase> = []): Folder {
    return { id: uuid(), name, children }
}

export function mkShared(name: string, steps: Step[]): SharedStep {
    return { id: uuid(), name, steps, updatedAt: nowISO() }
}
