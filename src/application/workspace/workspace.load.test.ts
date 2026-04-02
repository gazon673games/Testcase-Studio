import { beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
    apiClient: {
        loadState: vi.fn(),
        saveState: vi.fn(),
        writeStateSnapshot: vi.fn(),
        writePublishLog: vi.fn(),
    },
}))

vi.mock('@ipc/client', () => clientMocks)

import { loadWorkspaceState, writeWorkspacePublishLog, writeWorkspaceSnapshot } from './store'
import { makeWorkspace } from './testSupport'

describe('workspace load and recovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('normalizes the loaded workspace snapshot before returning it', async () => {
        clientMocks.apiClient.loadState.mockResolvedValue({
            root: {
                name: 'Workspace root',
                children: [
                    {
                        name: 'Imported case',
                        steps: [{}],
                    },
                ],
            },
            sharedSteps: [],
        })

        const state = await loadWorkspaceState()

        expect(state.root.name).toBe('Workspace root')
        expect(state.root.children).toHaveLength(1)
        expect('steps' in state.root.children[0] ? state.root.children[0].steps.length : 0).toBe(1)
    })

    it('propagates load failures instead of silently replacing the workspace', async () => {
        clientMocks.apiClient.loadState.mockRejectedValue(new Error('disk read failed'))

        await expect(loadWorkspaceState()).rejects.toThrow('disk read failed')
    })

    it('writes a normalized snapshot for publish auditing', async () => {
        const { state } = makeWorkspace()
        clientMocks.apiClient.writeStateSnapshot.mockResolvedValue('/tmp/snapshot.json')

        const snapshotPath = await writeWorkspaceSnapshot(state, 'publish', { scope: 'workspace' })

        expect(snapshotPath).toBe('/tmp/snapshot.json')
        expect(clientMocks.apiClient.writeStateSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({ root: expect.objectContaining({ name: state.root.name }) }),
            'publish',
            { scope: 'workspace' }
        )
    })

    it('writes the publish log payload as an auditable artifact', async () => {
        clientMocks.apiClient.writePublishLog.mockResolvedValue('/tmp/publish-log.json')

        const logPath = await writeWorkspacePublishLog({ kind: 'zephyr-publish', status: 'ok' })

        expect(logPath).toBe('/tmp/publish-log.json')
        expect(clientMocks.apiClient.writePublishLog).toHaveBeenCalledWith({
            kind: 'zephyr-publish',
            status: 'ok',
        })
    })
})
