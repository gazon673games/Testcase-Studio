import { describe, expect, it } from 'vitest'
import { buildRefCatalog, inspectWikiRefs, makeStepRef, renderRefsInText, resolveRefsInText } from './refs'
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

    it('marks legacy refs by name as broken when multiple tests share the same name', () => {
        const left = mkTest('Duplicate case')
        left.id = 'test-left'
        left.steps = [mkStep('Left action', '', '')]

        const right = mkTest('Duplicate case')
        right.id = 'test-right'
        right.steps = [mkStep('Right action', '', '')]

        const [resolved] = inspectWikiRefs('[[Duplicate case#1.action]]', buildRefCatalog([left, right], []))

        expect(resolved.ok).toBe(false)
        expect(resolved.brokenReason).toBe('Source name is ambiguous')
    })

    it('renders image-style refs as embedded html in html mode', () => {
        const owner = mkTest('Embed case')
        owner.id = 'test-embed'
        const step = mkStep('**Embedded** action', '', '')
        step.id = 'step-embed'
        owner.steps = [step]

        const html = renderRefsInText(`![[${makeStepRef('test', owner.id, step.id, 'action')}]]`, buildRefCatalog([owner], []), {
            mode: 'html',
        })

        expect(html).toContain('tsh-ref-embed')
        expect(html).toContain('<strong>Embedded</strong>')
    })
})
