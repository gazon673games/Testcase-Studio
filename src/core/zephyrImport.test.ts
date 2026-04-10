import { describe, expect, it } from 'vitest'
import { mkStep, mkTest, normalizeTestCase } from './domain'
import { buildImportManagedSignature } from '@app/sync'

describe('buildImportManagedSignature', () => {
    it('includes shared refs, step attachments, and blocks in the import baseline', () => {
        const test = mkTest('Imported case')
        const step = mkStep('Action', 'Data', 'Expected')
        step.id = 'step-1'
        step.raw = { action: 'Action', data: 'Data', expected: 'Expected' }
        step.source = { sourceStepId: 'provider-1' }
        test.steps = [step]

        const base = buildImportManagedSignature(normalizeTestCase(test), [])

        step.usesShared = 'shared-login'
        step.attachments = [{ id: 'att-step', name: 'proof.png', pathOrDataUrl: '/tmp/proof.png' }]
        step.internal!.parts!.action = [{ id: 'part-1', text: 'More detail', export: true }]

        const enriched = buildImportManagedSignature(normalizeTestCase(test), [])

        expect(enriched).not.toBe(base)
    })
})
