import { describe, expect, it } from 'vitest'
import { buildZephyrPublishPreview } from './zephyrPublish'
import { mkFolder, mkStep, mkTest, type RootState } from './domain'
import type { ProviderTest } from '@providers/types'

describe('buildZephyrPublishPreview', () => {
    it('plans upload and delete operations for case and step attachments', () => {
        const test = mkTest('Publish case')
        test.id = 'test-publish'
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T1' }]
        test.attachments = [{ id: 'local-top', name: 'case-proof.png', pathOrDataUrl: '/tmp/case-proof.png' }]

        const step = mkStep('Action', '', '')
        step.attachments = [{ id: 'local-step', name: 'step-proof.png', pathOrDataUrl: '/tmp/step-proof.png' }]
        test.steps = [step]

        const state: RootState = {
            root: mkFolder('Root', [test]),
            sharedSteps: [],
        }

        const remote: ProviderTest = {
            id: 'PROJ-T1',
            name: 'Publish case',
            description: '',
            steps: [{ action: 'Action', data: '', expected: '', text: 'Action', attachments: [] }],
            attachments: [{ id: 'remote-old', name: 'old-proof.png', pathOrDataUrl: 'https://example.test/old-proof.png' }],
            updatedAt: '2026-03-27T00:00:00.000Z',
            extras: {},
        }

        const preview = buildZephyrPublishPreview(state, [test], new Map([['PROJ-T1', remote]]), 'Current case')
        const [item] = preview.items

        expect(item.attachmentsToUpload.map((attachment) => attachment.name)).toEqual(['case-proof.png', 'step-proof.png'])
        expect(item.attachmentIdsToDelete).toEqual(['remote-old'])
    })
})
