import { describe, expect, it } from 'vitest'
import { buildExport } from './export'
import { mkFolder, mkStep, mkTest, type RootState } from './domain'

describe('buildExport', () => {
    it('resolves wiki refs and preserves top-level text when blocks exist', () => {
        const source = mkTest('Source case')
        source.id = 'test-source'
        const sourceStep = mkStep('Imported action', '', '')
        sourceStep.id = 'step-source'
        source.steps = [sourceStep]

        const target = mkTest('Target case')
        target.id = 'test-target'
        const targetStep = mkStep('![[id:test-source#step-source.action]]', 'payload', '')
        targetStep.id = 'step-target'
        targetStep.internal!.parts!.action = [
            { id: 'block-visible', text: 'Manual continuation' },
            { id: 'block-hidden', text: 'Should stay hidden', export: false },
        ]
        target.steps = [targetStep]

        const state: RootState = {
            root: mkFolder('Root', [source, target]),
            sharedSteps: [],
        }

        const exported = buildExport(target, state)

        expect(exported.steps[0]).toMatchObject({
            action: 'Imported action\nManual continuation',
            data: 'payload',
        })
    })
})
