import { describe, expect, it } from 'vitest'
import { mkStep } from './domain'
import { applyZephyrHtmlPartsParsing, isZephyrHtmlPartsEnabled, setZephyrHtmlPartsEnabled } from './zephyrHtmlParts'

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
})
