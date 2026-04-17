import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeMocks = vi.hoisted(() => ({
    saveWorkspaceState: vi.fn(async () => {}),
}))

vi.mock('./store', () => ({
    saveWorkspaceState: storeMocks.saveWorkspaceState,
}))

import { saveWorkspace } from '../operations/saveWorkspace'
import { makeWorkspace } from '../testSupport'

describe('workspace persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns false when there is no loaded state', async () => {
        await expect(saveWorkspace(null)).resolves.toBe(false)
        expect(storeMocks.saveWorkspaceState).not.toHaveBeenCalled()
    })

    it('persists the workspace when state is available', async () => {
        const { state } = makeWorkspace()

        await expect(saveWorkspace(state)).resolves.toBe(true)
        expect(storeMocks.saveWorkspaceState).toHaveBeenCalledWith(state)
    })
})
