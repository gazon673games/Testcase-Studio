import { nowISO, type ID, type RootState, type TestCase } from '@core/domain'
import { findNode, isFolder } from '@core/tree'
import { SyncEngine } from '@core/syncEngine'
import { resolveZephyrExternalId } from '@core/zephyrPublish'
import { fromProviderPayload } from '@providers/mappers'
import { getSelectedNode } from './queries'

export type PullSelectedCaseResult =
    | { status: 'no-selection' | 'not-a-test' | 'no-link' }
    | {
          status: 'ok'
          nextState: RootState
          testId: string
          externalId: string
          clearedDirtyIds: string[]
      }

export async function pullSelectedCase(
    state: RootState | null,
    selectedId: ID | null,
    sync: SyncEngine
): Promise<PullSelectedCaseResult> {
    const node = getSelectedNode(state, selectedId)
    if (!state || !node) return { status: 'no-selection' }
    if (isFolder(node)) return { status: 'not-a-test' }

    const zephyrExternalId = resolveZephyrExternalId(node)
    const fallbackLink =
        zephyrExternalId
            ? { provider: 'zephyr' as const, externalId: zephyrExternalId }
            : node.links.find((link) => link.provider === 'allure') ?? node.links[0]

    if (!fallbackLink) return { status: 'no-link' }

    const remote = await sync.pullByLink(fallbackLink)
    const nextState = structuredClone(state)
    const target = findNode(nextState.root, node.id) as TestCase
    const patch = fromProviderPayload(remote, target.steps)

    target.name = patch.name
    target.description = patch.description
    target.steps = patch.steps
    target.attachments = patch.attachments
    target.meta = patch.meta
    target.updatedAt = patch.updatedAt ?? nowISO()

    return {
        status: 'ok',
        nextState,
        testId: target.id,
        externalId:
            zephyrExternalId
            ?? node.links.find((link) => link.provider === 'zephyr')?.externalId
            ?? fallbackLink.externalId
            ?? remote.id
            ?? '',
        clearedDirtyIds: [target.id],
    }
}
