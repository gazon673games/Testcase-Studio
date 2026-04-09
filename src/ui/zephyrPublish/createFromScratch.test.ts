import { describe, expect, it } from 'vitest'
import { buildCreateFromScratchChecks, canCreateFromScratch, getCreateFromScratchItem } from './createFromScratch'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem } from '@app/sync'

function makeItem(overrides: Partial<ZephyrPublishPreviewItem> = {}): ZephyrPublishPreviewItem {
    return {
        id: 'item-1',
        testId: 'test-1',
        testName: 'Local test',
        status: 'create',
        reason: 'Will create a new Zephyr test case',
        publish: true,
        diffs: [],
        payload: {
            id: '',
            name: 'Local test',
            description: '',
            steps: [{ action: 'Do something', data: '', expected: 'See result', text: 'Do something' }],
            attachments: [],
            extras: { projectKey: 'PROJ', customFields: { 'Test Type': 'Regression', Automation: 'Automated' } },
        },
        attachmentsToUpload: [],
        attachmentIdsToDelete: [],
        attachmentWarnings: [],
        ...overrides,
    }
}

function makePreview(item: ZephyrPublishPreviewItem): ZephyrPublishPreview {
    return {
        selectionLabel: 'Current test',
        generatedAt: '2026-04-09T00:00:00.000Z',
        items: [item],
        summary: { total: 1, create: 1, update: 0, skip: 0, blocked: 0 },
    }
}

const t = (key: string, params?: Record<string, string | number>) =>
    key === 'publish.createCheck.stepsCount'
        ? `steps:${params?.count ?? 0}`
        : key

describe('create from scratch publish helpers', () => {
    it('detects a single publish item without external id as create candidate', () => {
        const preview = makePreview(makeItem())
        expect(getCreateFromScratchItem(preview)?.testId).toBe('test-1')
    })

    it('rejects items that already have external ids', () => {
        const preview = makePreview(makeItem({ externalId: 'PROJ-T1', payload: { ...makeItem().payload, id: 'PROJ-T1' } }))
        expect(getCreateFromScratchItem(preview)).toBeNull()
    })

    it('reports missing required fields and blocks creation', () => {
        const item = makeItem({
            status: 'blocked',
            publish: false,
            reason: 'Missing projectKey for create publish',
            payload: {
                id: '',
                name: '',
                description: '',
                steps: [{ action: '', data: '', expected: '', text: '' }],
                attachments: [],
                extras: { customFields: {} },
            },
        })

        const checks = buildCreateFromScratchChecks(item, t)
        expect(checks.filter((check) => !check.passed).map((check) => check.id)).toEqual([
            'name',
            'projectKey',
            'stepContent',
            'testType',
            'automation',
            'payload',
        ])
        expect(canCreateFromScratch(item, t)).toBe(false)
    })
})
