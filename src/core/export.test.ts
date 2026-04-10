import { describe, expect, it } from 'vitest'
import { buildExport, ExportIntegrityError } from './export'
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
        targetStep.presentation!.parts!.action = [
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

    it('does not include hidden source blocks in whole-field refs', () => {
        const source = mkTest('Source case')
        source.id = 'test-source'
        const sourceStep = mkStep('Visible head', '', '')
        sourceStep.id = 'step-source'
        sourceStep.presentation!.parts!.action = [
            { id: 'source-visible', text: 'Visible tail' },
            { id: 'source-hidden', text: 'Hidden tail', export: false },
        ]
        source.steps = [sourceStep]

        const target = mkTest('Target case')
        target.id = 'test-target'
        target.steps = [mkStep(`[[id:${source.id}#${sourceStep.id}.action]]`, '', '')]

        const state: RootState = {
            root: mkFolder('Root', [source, target]),
            sharedSteps: [],
        }

        const exported = buildExport(target, state)
        expect(exported.steps[0]?.action).toBe('Visible head\nVisible tail')
    })

    it('blocks export when a reference cycle is detected', () => {
        const owner = mkTest('Cycle case')
        owner.id = 'test-cycle'
        const step = mkStep('', '', '')
        step.id = 'step-cycle'
        step.action = '[[id:test-cycle#step-cycle.action]]'
        owner.steps = [step]

        const state: RootState = {
            root: mkFolder('Root', [owner]),
            sharedSteps: [],
        }

        expect(() => buildExport(owner, state)).toThrow(ExportIntegrityError)
    })
})
