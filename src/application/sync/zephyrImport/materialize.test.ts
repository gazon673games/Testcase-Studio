import { describe, expect, it } from 'vitest'
import { mkTest } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import { buildLocalMatchIndex, findLocalMatches, upsertLocalMatch } from './materialize'

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
})
