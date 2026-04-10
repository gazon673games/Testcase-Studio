import { describe, expect, it } from 'vitest'
import { mkStep, mkTest } from './domain'
import {
    applyZephyrHtmlPartsParsing,
    beautifyZephyrJsonBlocksInStep,
    inspectZephyrJsonBeautifyStep,
    isZephyrHtmlPartsEnabled,
    setZephyrHtmlPartsEnabled,
} from './zephyrHtmlParts'

describe('zephyr html parts parsing', () => {
    it('splits html fields into top level text and extra parts using double breaks', () => {
        const step = mkStep(
            '<strong>РџСЂРѕРІРµСЂРёС‚СЊ</strong><br /><br />Р’С‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span><br /><br /><span>РіРґРµ {{id}} - Р·РЅР°С‡РµРЅРёРµ РёР· РѕС‚РІРµС‚Р°</span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.action).toBe('<strong>РџСЂРѕРІРµСЂРёС‚СЊ</strong>')
        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            'Р’С‹РїРѕР»РЅРёС‚СЊ Р·Р°РїСЂРѕСЃ',
            '<span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
            '<span>РіРґРµ {{id}} - Р·РЅР°С‡РµРЅРёРµ РёР· РѕС‚РІРµС‚Р°</span>',
        ])
    })

    it('stores and reads the per-test parse flag in test integration', () => {
        const test = mkTest('HTML parsing')
        setZephyrHtmlPartsEnabled(test, true)
        expect(isZephyrHtmlPartsEnabled(test)).toBe(true)

        setZephyrHtmlPartsEnabled(test, false)
        expect(isZephyrHtmlPartsEnabled(test)).toBe(false)
    })

    it('beautifies valid json blocks after splitting zephyr html', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />&quot;insurance_object&quot;: [<br />{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}<br />]}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.action).toBe('<strong>Inspect</strong>')
        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "insurance_object": [<br />    {<br />      "id": "1",<br />      "active": true<br />    }<br />  ]<br />}</em>',
        ])
    })

    it('keeps invalid json blocks unchanged', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />"insurance_object": [<br />{<br />"id": "1"<br />"active": true<br />}<br />]}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<span><em>{<br />"insurance_object": [<br />{<br />"id": "1"<br />"active": true<br />}<br />]}</em></span>',
        ])
    })

    it('repairs a missing comma in tolerant mode before beautifying', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step, { tolerant: true })

        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
        ])
    })

    it('repairs a later missing comma between string fields in tolerant mode', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />"scoring_request_id": "8116acb5-4b3c-40df-8c05-9c02af105fa0"<br />"is_deleted": false,<br />"deleted_at": null<br />}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step, { tolerant: true })

        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "scoring_request_id": "8116acb5-4b3c-40df-8c05-9c02af105fa0",<br />  "is_deleted": false,<br />  "deleted_at": null<br />}</em>',
        ])
    })

    it('repairs a missing comma between keys on the same line in tolerant mode', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{ "test": 12, "test1": "test" "test2": "test" }</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step, { tolerant: true })

        expect(parsed.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "test": 12,<br />  "test1": "test",<br />  "test2": "test"<br />}</em>',
        ])
    })

    it('beautifies json blocks in existing step parts on demand', () => {
        const step = mkStep('Inspect')
        step.presentation!.parts!.action = [{
            id: 'part-1',
            text: '<span><em>{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}</em></span>',
        }]

        const beautified = beautifyZephyrJsonBlocksInStep(step)

        expect(beautified.presentation?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
        ])
    })

    it('reports parse errors for json-like blocks that still cannot be repaired', () => {
        const step = mkStep('Inspect')
        step.presentation!.parts!.action = [{
            id: 'part-1',
            text: '<span><em>{ "test": 12, "test1": "test" "test2":"test }</em></span>',
        }]

        const diagnostics = inspectZephyrJsonBeautifyStep(step, { tolerant: true })

        expect(diagnostics.candidateCount).toBe(1)
        expect(diagnostics.failures).toHaveLength(1)
        expect(diagnostics.failures[0]?.source).toBe('part')
        expect(diagnostics.failures[0]?.strictError).toBeTruthy()
        expect(diagnostics.failures[0]?.candidate).toContain('"test1": "test" "test2"')
    })
})
