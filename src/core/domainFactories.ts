import { v4 as uuid } from 'uuid'
import type { Folder, SharedStep, Step, SubStep, TestCase } from './domainTypes'
import { normalizeFolder, normalizeSharedStep, normalizeStep, normalizeTestCase, nowISO } from './domainNormalization'

export function mkSubStep(title = '', text = ''): SubStep {
    return { id: uuid(), title, text }
}

export function mkStep(action = '', data = '', expected = ''): Step {
    return normalizeStep({
        id: uuid(),
        action,
        data,
        expected,
        text: action || '',
        raw: { action, data, expected },
        subSteps: [],
        internal: { parts: { action: [], data: [], expected: [] } },
        attachments: [],
    })
}

export function mkTest(name: string, description?: string): TestCase {
    return normalizeTestCase({
        id: uuid(),
        name,
        description,
        steps: [],
        attachments: [],
        links: [],
        updatedAt: nowISO(),
        meta: { tags: [], params: {} },
        exportCfg: { enabled: true },
    })
}

export function mkFolder(name: string, children: Array<Folder | TestCase> = []): Folder {
    return normalizeFolder({ id: uuid(), name, children }, name)
}

export function mkShared(name: string, steps: Step[]): SharedStep {
    return normalizeSharedStep({ id: uuid(), name, steps, updatedAt: nowISO() })
}
