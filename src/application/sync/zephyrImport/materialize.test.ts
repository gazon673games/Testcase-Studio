import { describe, expect, it } from 'vitest'
import { mkTest } from '@core/domain'
import { setZephyrHtmlPartsEnabled } from '@core/zephyrHtmlParts'
import type { ProviderTest } from '@providers/types'
import { buildLocalMatchIndex, findLocalMatches, materializeImportedTest, upsertLocalMatch } from './materialize'

function remote(ref: string): ProviderTest {
    return {
        id: ref,
        name: ref,
        steps: [],
        attachments: [],
    }
}

describe('zephyr import local match index', () => {
    it('matches tests by zephyr link, meta key, imported remote key, and trailing digits', () => {
        const byLink = mkTest('By link')
        byLink.links = [{ provider: 'zephyr', externalId: 'PROJ-T101' }]

        const byMetaKey = mkTest('By meta key')
        byMetaKey.meta = { ...(byMetaKey.meta ?? { tags: [], params: {} }), params: { key: 'PROJ-T202' }, tags: [] }

        const byImportKey = mkTest('By import key')
        byImportKey.meta = {
            ...(byImportKey.meta ?? { tags: [], params: {} }),
            params: { '__zephyrImport.remoteKey': 'PROJ-T303' },
            tags: [],
        }

        const byDigits = mkTest('By digits')
        byDigits.meta = { ...(byDigits.meta ?? { tags: [], params: {} }), params: { keyNumber: '404' }, tags: [] }

        const index = buildLocalMatchIndex([byLink, byMetaKey, byImportKey, byDigits])

        expect(findLocalMatches(remote('PROJ-T101'), index).map((test) => test.id)).toEqual([byLink.id])
        expect(findLocalMatches(remote('PROJ-T202'), index).map((test) => test.id)).toEqual([byMetaKey.id])
        expect(findLocalMatches(remote('PROJ-T303'), index).map((test) => test.id)).toEqual([byImportKey.id])
        expect(findLocalMatches(remote('PROJ-T404'), index).map((test) => test.id)).toEqual([byDigits.id])
    })

    it('reindexes a test when its zephyr reference changes', () => {
        const test = mkTest('Mutable match')
        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T10' }]

        const index = buildLocalMatchIndex([test])
        expect(findLocalMatches(remote('PROJ-T10'), index).map((item) => item.id)).toEqual([test.id])

        test.links = [{ provider: 'zephyr', externalId: 'PROJ-T11' }]
        upsertLocalMatch(index, test)

        expect(findLocalMatches(remote('PROJ-T10'), index)).toEqual([])
        expect(findLocalMatches(remote('PROJ-T11'), index).map((item) => item.id)).toEqual([test.id])
    })

    it('splits imported Zephyr html into parts only when the test flag is enabled', () => {
        const existing = mkTest('Imported case')
        existing.meta = setZephyrHtmlPartsEnabled(existing.meta, true)

        const imported = materializeImportedTest({
            id: 'PROJ-T500',
            name: 'Imported case',
            steps: [{
                action: '<strong>Проверить</strong><br /><br />Подготовить данные<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
                data: '',
                expected: '',
                text: '<strong>Проверить</strong><br /><br />Подготовить данные<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
            }],
            attachments: [],
        }, existing)

        expect(imported.steps[0]?.action).toBe('<strong>Проверить</strong>')
        expect(imported.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            'Подготовить данные',
            '<span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
        ])
    })
    it('beautifies valid json blocks during import when the test flag is enabled', () => {
        const existing = mkTest('Imported case')
        existing.meta = setZephyrHtmlPartsEnabled(existing.meta, true)

        const imported = materializeImportedTest({
            id: 'PROJ-T501',
            name: 'Imported case',
            steps: [{
                action: '<strong>Inspect</strong><br /><br /><span><em>{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}</em></span>',
                data: '',
                expected: '',
                text: '<strong>Inspect</strong><br /><br /><span><em>{<br />&quot;id&quot;: &quot;1&quot;,<br />&quot;active&quot;: true<br />}</em></span>',
            }],
            attachments: [],
        }, existing)

        expect(imported.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
        ])
    })

    it('repairs a missing comma during import only when tolerant json beautify is enabled', () => {
        const existing = mkTest('Imported case')
        existing.meta = setZephyrHtmlPartsEnabled(existing.meta, true)

        const remote = {
            id: 'PROJ-T502',
            name: 'Imported case',
            steps: [{
                action: '<strong>Inspect</strong><br /><br /><span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>',
                data: '',
                expected: '',
                text: '<strong>Inspect</strong><br /><br /><span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>',
            }],
            attachments: [],
        }

        const strictImported = materializeImportedTest(remote, existing, { tolerantJsonBeautify: false })
        const tolerantImported = materializeImportedTest(remote, existing, { tolerantJsonBeautify: true })

        expect(strictImported.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>',
        ])
        expect(tolerantImported.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
        ])
    })

    it('repairs a later missing comma between JSON fields during import in tolerant mode', () => {
        const existing = mkTest('Imported case')
        existing.meta = setZephyrHtmlPartsEnabled(existing.meta, true)

        const tolerantImported = materializeImportedTest({
            id: 'PROJ-T503',
            name: 'Imported case',
            steps: [{
                action: '<strong>Inspect</strong><br /><br /><span><em>{<br />"scoring_request_id": "8116acb5-4b3c-40df-8c05-9c02af105fa0"<br />"is_deleted": false,<br />"deleted_at": null<br />}</em></span>',
                data: '',
                expected: '',
                text: '<strong>Inspect</strong><br /><br /><span><em>{<br />"scoring_request_id": "8116acb5-4b3c-40df-8c05-9c02af105fa0"<br />"is_deleted": false,<br />"deleted_at": null<br />}</em></span>',
            }],
            attachments: [],
        }, existing, { tolerantJsonBeautify: true })

        expect(tolerantImported.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            '<em>{<br />  "scoring_request_id": "8116acb5-4b3c-40df-8c05-9c02af105fa0",<br />  "is_deleted": false,<br />  "deleted_at": null<br />}</em>',
        ])
    })
})
