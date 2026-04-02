import { describe, expect, it } from 'vitest'
import { mkFolder, mkStep, mkTest } from '@core/domain'
import { buildNodeSyncStatusIndex, flattenVisibleItems, makeNodeKey, makeStepKey } from './utils'

describe('tree utils', () => {
    it('flattens visible items without computing step labels into the nav list', () => {
        const test = mkTest('Case A')
        test.steps = [mkStep('First action'), mkStep('Second action')]

        const folder = mkFolder('Suite', [test])
        const root = mkFolder('Root', [folder])
        const expanded = new Set([root.id, folder.id, test.id])

        const items = flattenVisibleItems(root, expanded)

        expect(items.map((item) => item.key)).toEqual([
            makeNodeKey(root.id),
            makeNodeKey(folder.id),
            makeNodeKey(test.id),
            makeStepKey(test.id, test.steps[0].id),
            makeStepKey(test.id, test.steps[1].id),
        ])
        expect('name' in items[3]).toBe(false)
    })

    it('builds dirty sync status for tests and all dirty ancestor folders in one pass', () => {
        const cleanTest = mkTest('Clean case')
        const dirtyTest = mkTest('Dirty case')

        const folder = mkFolder('Suite', [cleanTest, dirtyTest])
        const root = mkFolder('Root', [folder])

        const index = buildNodeSyncStatusIndex(root, new Set([dirtyTest.id]))

        expect(index.get(dirtyTest.id)).toBe('dirty')
        expect(index.get(folder.id)).toBe('dirty')
        expect(index.get(root.id)).toBe('dirty')
        expect(index.has(cleanTest.id)).toBe(false)
    })
})
