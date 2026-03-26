    // @core/domain.ts
    import { v4 as uuid } from 'uuid'

    /* ────────────────────────────────────────────────────────── */
    /* БАЗОВЫЕ ТИПЫ */

    export type ProviderKind = 'zephyr' | 'allure'
    export type ID = string
    export type SharedStepID = string

    /* ────────────────────────────────────────────────────────── */
    /* ВЛОЖЕНИЯ (файлы) */

    export interface Attachment {
        id: ID
        name: string
        /** Абсолютный/относительный путь или data:URL */
        pathOrDataUrl: string
    }

    /* ────────────────────────────────────────────────────────── */
    /* ШАГ — ЧАСТИ (локальная детализация Action/Data/Expected) */

    export interface PartItem {
        id: ID
        text: string
        /** если true — именно эта часть участвует в экспорте; если false — локальная (неэкспортируемая) */
        export?: boolean
    }

    export interface StepInternal {
        note?: string
        url?: string
        /** произвольные служебные поля */
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

    /* ────────────────────────────────────────────────────────── */
    /* ШАГ ТЕСТА */

    export interface Step {
        id: ID
        action?: string
        data?: string
        expected?: string
        text?: string

        // 🆕 исходник шага (например HTML из Zephyr)
        raw?: {
            action?: string
            data?: string
            expected?: string
        }

        subSteps?: SubStep[]
        internal?: StepInternal
        usesShared?: SharedStepID
        attachments?: Attachment[]
    }

    /* ────────────────────────────────────────────────────────── */
    /* МЕТАДАННЫЕ ТЕСТА (теги + кастомные параметры) */

    export interface TestMeta {
        /**
         * Кастомные параметры (вместо «базовых»).
         * UI может давать редактировать только этот словарь.
         */
        params?: Record<string, string>

        /** Теги. */
        tags: string[]

        /** Markdown-поля (как и раньше): */
        objective?: string
        preconditions?: string

        /**
         * 👇 Опциональные «базовые» поля оставлены для обратной совместимости.
         * Если не нужны — UI их просто не показывает/не пишет.
         */
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

    /* ────────────────────────────────────────────────────────── */
    /* ССЫЛКИ НА ВНЕШНИЕ TMS */

    export interface TestCaseLink {
        provider: ProviderKind
        externalId: string
    }

    /* ────────────────────────────────────────────────────────── */
    /* ТЕСТ, ПАПКИ, ШАРЕННЫЕ ШАГИ, КОРНЕВОЕ СОСТОЯНИЕ */

    export interface ExportConfig {
        enabled: boolean
    }

    export interface TestCase {
        id: ID
        name: string
        description?: string
        steps: Step[]

        /** Вложения теста (глобальные, на уровне тест-кейса) */
        attachments: Attachment[]

        /** Ссылки на внешние системы */
        links: TestCaseLink[]

        updatedAt: string

        /** Параметры/теги */
        meta?: TestMeta

        /** Флаги экспорта */
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

    /* ────────────────────────────────────────────────────────── */
    /* УТИЛИТЫ/ФАБРИКИ */

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
            raw: { action, data, expected }, // 🆕
            subSteps: [],
            internal: { parts: { action: [], data: [], expected: [] } },
            attachments: []
        }
    }

    export function mkTest(name: string, description?: string): TestCase {
        return {
            id: uuid(),
            name,
            description,
            steps: [],
            attachments: [],  // вложения теста
            links: [],
            updatedAt: nowISO(),
            meta: { tags: [], params: {} }, // 🆕 по умолчанию — пустые кастомные параметры
            exportCfg: { enabled: true }
        }
    }

    export function mkFolder(name: string, children: Array<Folder | TestCase> = []): Folder {
        return { id: uuid(), name, children }
    }

    export function mkShared(name: string, steps: Step[]): SharedStep {
        return { id: uuid(), name, steps, updatedAt: nowISO() }
    }
