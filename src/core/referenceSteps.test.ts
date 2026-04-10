import { describe, expect, it } from 'vitest'
import { mkStep, mkTest } from './domain'
import { buildReferenceStepsFromTest, canReferenceTestStep } from './referenceSteps'

describe('referenceSteps', () => {
    it('builds per-field refs for selected steps in source order', () => {
        const source = mkTest('Reusable flow')
        const first = mkStep('Open page', '', 'Shown')
        const second = mkStep('', 'Payload', '')
        source.steps = [first, second]

        const inserted = buildReferenceStepsFromTest(source, [second.id, first.id])

        expect(inserted).toHaveLength(2)
        expect(inserted[0]).toMatchObject({
            action: `[[id:${source.id}#${first.id}.action]]`,
            data: '',
            expected: `[[id:${source.id}#${first.id}.expected]]`,
            text: `[[id:${source.id}#${first.id}.action]]`,
        })
        expect(inserted[1]).toMatchObject({
            action: '',
            data: `[[id:${source.id}#${second.id}.data]]`,
            expected: '',
            text: `[[id:${source.id}#${second.id}.data]]`,
        })
    })

    it('treats step parts as referenceable content', () => {
        const source = mkTest('Flow with blocks')
        const step = mkStep('', '', '')
        step.presentation!.parts!.expected!.push({ id: 'part-1', text: 'Block value' })
        source.steps = [step]

        const inserted = buildReferenceStepsFromTest(source, [step.id])

        expect(canReferenceTestStep(step)).toBe(true)
        expect(inserted).toHaveLength(1)
        expect(inserted[0]?.expected).toBe(`[[id:${source.id}#${step.id}.expected]]`)
    })

    it('skips non-referenceable steps', () => {
        const source = mkTest('Empty flow')
        const empty = mkStep('', '', '')
        source.steps = [empty]

        expect(canReferenceTestStep(empty)).toBe(false)
        expect(buildReferenceStepsFromTest(source, [empty.id])).toEqual([])
    })
})
