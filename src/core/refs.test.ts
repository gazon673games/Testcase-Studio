import { describe, expect, it } from 'vitest'
import { buildRefCatalog, makeStepRef, resolveRefsInText } from './refs'
import { mkStep, mkTest } from './domain'

describe('resolveRefsInText', () => {
    it('returns combined top-level text and blocks for whole-field refs', () => {
        const owner = mkTest('Composite case')
        owner.id = 'test-composite'
        const step = mkStep('Base action', '', '')
        step.id = 'step-composite'
        step.internal!.parts!.action = [
            { id: 'block-1', text: 'Follow-up block' },
        ]
        owner.steps = [step]

        const catalog = buildRefCatalog([owner], [])

        expect(resolveRefsInText(`[[${makeStepRef('test', owner.id, step.id, 'action')}]]`, catalog)).toBe(
            'Base action\nFollow-up block'
        )
    })

    it('keeps part refs targeted to a single block', () => {
        const owner = mkTest('Composite case')
        owner.id = 'test-composite'
        const step = mkStep('Base action', '', '')
        step.id = 'step-composite'
        step.internal!.parts!.action = [
            { id: 'block-1', text: 'Follow-up block' },
        ]
        owner.steps = [step]

        const catalog = buildRefCatalog([owner], [])

        expect(resolveRefsInText(`[[${makeStepRef('test', owner.id, step.id, 'action', 'block-1')}]]`, catalog)).toBe(
            'Follow-up block'
        )
    })
})
