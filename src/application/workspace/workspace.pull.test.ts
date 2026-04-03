import { describe, expect, it, vi } from 'vitest'
import { isZephyrHtmlPartsEnabled, setZephyrHtmlPartsEnabled } from '@core/zephyrHtmlParts'
import { pullSelectedCase } from './pullSelectedCase'
import { makeProviderTest, makeSyncService, makeWorkspace } from './testSupport'
import { findNode, isFolder } from '@core/tree'

describe('workspace pull selected case', () => {
    it('returns no-link when the selected test has no external references', async () => {
        const { state, folderTest } = makeWorkspace()
        const sync = makeSyncService()

        const result = await pullSelectedCase(state, folderTest.id, sync)

        expect(result).toEqual({ status: 'no-link' })
    })

    it('prefers the Zephyr link over fallback providers', async () => {
        const { state, folderTest } = makeWorkspace()
        const selected = findNode(state.root, folderTest.id)
        if (!selected || isFolder(selected)) throw new Error('Expected a test node in the workspace state')

        selected.links = [
            { provider: 'allure', externalId: 'AL-7' },
            { provider: 'zephyr', externalId: 'PROJ-T77' },
        ]

        const sync = makeSyncService({
            pullByLink: vi.fn(async (link) =>
                makeProviderTest({
                    id: link.externalId,
                    name: link.provider === 'zephyr' ? 'Remote folder test from Zephyr' : 'Remote fallback test',
                    description: link.provider === 'zephyr' ? 'Pulled from Zephyr' : 'Pulled from fallback',
                })
            ),
        })

        const result = await pullSelectedCase(state, folderTest.id, sync)

        expect(result).toMatchObject({ status: 'ok', externalId: 'PROJ-T77' })
        if (result.status !== 'ok') throw new Error('Expected ok result')

        const updated = findNode(result.nextState.root, folderTest.id)
        expect(updated && !isFolder(updated) ? updated.name : '').toBe('Remote folder test from Zephyr')
        expect(updated && !isFolder(updated) ? updated.description : '').toBe('Pulled from Zephyr')
    })

    it('preserves the html-part parsing flag and applies it during pull', async () => {
        const { state, folderTest } = makeWorkspace()
        const selected = findNode(state.root, folderTest.id)
        if (!selected || isFolder(selected)) throw new Error('Expected a test node in the workspace state')

        selected.links = [{ provider: 'zephyr', externalId: 'PROJ-T88' }]
        selected.meta = setZephyrHtmlPartsEnabled(selected.meta, true)

        const sync = makeSyncService({
            pullByLink: vi.fn(async () =>
                makeProviderTest({
                    id: 'PROJ-T88',
                    name: 'Remote case',
                    steps: [{
                        action: '<strong>Проверить</strong><br /><br />Выполнить запрос<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
                        data: '',
                        expected: '',
                        text: '<strong>Проверить</strong><br /><br />Выполнить запрос<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
                    }],
                })
            ),
        })

        const result = await pullSelectedCase(state, folderTest.id, sync)
        if (result.status !== 'ok') throw new Error('Expected ok result')

        const updated = findNode(result.nextState.root, folderTest.id)
        if (!updated || isFolder(updated)) throw new Error('Expected updated test node')

        expect(isZephyrHtmlPartsEnabled(updated.meta)).toBe(true)
        expect(updated.steps[0]?.action).toBe('<strong>Проверить</strong>')
        expect(updated.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
            'Выполнить запрос',
            '<span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>',
        ])
    })
    it('uses the tolerant json beautify setting during pull when html-part parsing is enabled', async () => {
        const storage = new Map<string, string>()
        const originalWindow = (globalThis as { window?: Window }).window
        ;(globalThis as { window?: Window }).window = {
            localStorage: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => void storage.set(key, value),
                removeItem: (key: string) => void storage.delete(key),
                clear: () => void storage.clear(),
                key: (index: number) => [...storage.keys()][index] ?? null,
                get length() {
                    return storage.size
                },
            } as Storage,
        } as Window
        globalThis.window.localStorage.setItem('ui.jsonBeautifyTolerant', 'true')
        try {
            const { state, folderTest } = makeWorkspace()
            const selected = findNode(state.root, folderTest.id)
            if (!selected || isFolder(selected)) throw new Error('Expected a test node in the workspace state')

            selected.links = [{ provider: 'zephyr', externalId: 'PROJ-T90' }]
            selected.meta = setZephyrHtmlPartsEnabled(selected.meta, true)

            const sync = makeSyncService({
                pullByLink: vi.fn(async () =>
                    makeProviderTest({
                        id: 'PROJ-T90',
                        name: 'Remote case',
                        steps: [{
                            action: '<strong>Inspect</strong><br /><br /><span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>',
                            data: '',
                            expected: '',
                            text: '<strong>Inspect</strong><br /><br /><span><em>{<br />"id": "1"<br />"active": true<br />}</em></span>',
                        }],
                    })
                ),
            })

            const result = await pullSelectedCase(state, folderTest.id, sync)
            if (result.status !== 'ok') throw new Error('Expected ok result')

            const updated = findNode(result.nextState.root, folderTest.id)
            if (!updated || isFolder(updated)) throw new Error('Expected updated test node')

            expect(updated.steps[0]?.internal?.parts?.action?.map((part) => part.text)).toEqual([
                '<em>{<br />  "id": "1",<br />  "active": true<br />}</em>',
            ])
        } finally {
            if (originalWindow) (globalThis as { window?: Window }).window = originalWindow
            else delete (globalThis as { window?: Window }).window
        }
    })

    it('clears previously parsed html blocks when the per-test flag is disabled before pull', async () => {
        const { state, folderTest } = makeWorkspace()
        const selected = findNode(state.root, folderTest.id)
        if (!selected || isFolder(selected)) throw new Error('Expected a test node in the workspace state')

        selected.links = [{ provider: 'zephyr', externalId: 'PROJ-T89' }]
        selected.steps[0] = {
            ...selected.steps[0],
            action: '<strong>Old</strong>',
            text: '<strong>Old</strong>',
            internal: {
                ...(selected.steps[0]?.internal ?? {}),
                parts: {
                    action: [{ id: 'part-1', text: '<em>SELECT 1</em>' }],
                    data: [],
                    expected: [],
                },
            },
        }
        selected.meta = setZephyrHtmlPartsEnabled(selected.meta, false)

        const remoteHtml = '<strong>Inspect</strong><br /><br />Prepare data<br /><br /><span><em>SELECT x.*<br />WHERE id=\'{{id}}\'</em></span>'
        const sync = makeSyncService({
            pullByLink: vi.fn(async () =>
                makeProviderTest({
                    id: 'PROJ-T89',
                    name: 'Remote case',
                    steps: [{
                        action: remoteHtml,
                        data: '',
                        expected: '',
                        text: remoteHtml,
                    }],
                })
            ),
        })

        const result = await pullSelectedCase(state, folderTest.id, sync)
        if (result.status !== 'ok') throw new Error('Expected ok result')

        const updated = findNode(result.nextState.root, folderTest.id)
        if (!updated || isFolder(updated)) throw new Error('Expected updated test node')

        expect(isZephyrHtmlPartsEnabled(updated.meta)).toBe(false)
        expect(updated.steps[0]?.action).toBe(remoteHtml)
        expect(updated.steps[0]?.internal?.parts?.action).toEqual([])
    })
})
