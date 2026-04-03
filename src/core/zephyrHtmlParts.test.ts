import { describe, expect, it } from 'vitest'
import { mkStep } from './domain'
import { applyZephyrHtmlPartsParsing, beautifyZephyrJsonBlocksInStep, isZephyrHtmlPartsEnabled, setZephyrHtmlPartsEnabled } from './zephyrHtmlParts'

describe('zephyr html parts parsing', () => {
    it('splits html fields into top level text and extra parts using double breaks', () => {
        const step = mkStep(
            '<strong>Проверить</strong><br /><br />Выполнить запрос<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span><br /><br /><span>где {{id}} - значение из ответа</span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.action).toBe('<strong>Проверить</strong>')
        expect(parsed.internal?.parts?.action?.map((part) => part.text)).toEqual([
            'Выполнить запрос',
            '<span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
            '<span>где {{id}} - значение из ответа</span>',
        ])
    })

    it('stores and reads the per-test parse flag in meta params', () => {
        const enabled = setZephyrHtmlPartsEnabled({ tags: [], params: {} }, true)
        const disabled = setZephyrHtmlPartsEnabled(enabled, false)

        expect(isZephyrHtmlPartsEnabled(enabled)).toBe(true)
        expect(isZephyrHtmlPartsEnabled(disabled)).toBe(false)
    })

    it('beautifies valid json blocks after splitting zephyr html', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />&quot;insurance_object&quot;: [<br />{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}<br />]}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.action).toBe('<strong>Inspect</strong>')
        expect(parsed.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "insurance_object": [<br />    {<br />      "id": "1",<br />      "active": true<br />    }<br />  ]<br />}</em>',
        ])
    })

    it('keeps invalid json blocks unchanged', () => {
        const step = mkStep(
            '<strong>Inspect</strong><br /><br /><span><em>{<br />"insurance_object": [<br />{<br />"id": "1"<br />"active": true<br />}<br />]}</em></span>'
        )

        const parsed = applyZephyrHtmlPartsParsing(step)

        expect(parsed.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<span><em>{<br />"insurance_object": [<br />{<br />"id": "1"<br />"active": true<br />}<br />]}</em></span>',
        ])
    })

    it('beautifies json blocks in existing step parts on demand', () => {
        const step = mkStep('Inspect')
        step.internal!.parts!.action = [{
            id: 'part-1',
            text: '<span><em>{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}</em></span>',
        }]

        const beautified = beautifyZephyrJsonBlocksInStep(step)

        expect(beautified.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
        ])
    })
})
