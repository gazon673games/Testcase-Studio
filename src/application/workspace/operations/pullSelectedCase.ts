import { produce } from 'immer'
import { normalizeTestCase, nowISO, type ID, type RootState, type TestCase } from '@core/domain'
import { isZephyrHtmlPartsEnabled, preserveZephyrHtmlPartsFlag } from '@core/zephyrHtmlParts'
import { findNode, isFolder } from '@core/tree'
import { resolveZephyrExternalId, type SyncService } from '@app/sync'
import { fromProviderPayload } from '@providers/mappers'
import { getStoredJsonBeautifyTolerant } from '@shared/uiPreferences'
import { getSelectedNode } from '../core/queries'

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
    sync: SyncService
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
    const patch = fromProviderPayload(remote, node.steps, {
        parseHtmlParts: isZephyrHtmlPartsEnabled(node),
        tolerantJsonBeautify: getStoredJsonBeautifyTolerant(),
    })
    const merged = preserveZephyrHtmlPartsFlag(
        node,
        normalizeTestCase({
            ...node,
            name: patch.name,
            description: patch.description,
            steps: patch.steps,
            attachments: patch.attachments,
            details: patch.details,
            integration: patch.integration,
            updatedAt: patch.updatedAt ?? nowISO(),
        })
    )
    const nextState = produce(state, (draft) => {
        const target = findNode(draft.root, node.id) as TestCase
        Object.assign(target, merged)
    })

    return {
        status: 'ok',
        nextState,
        testId: node.id,
        externalId:
            zephyrExternalId
            ?? node.links.find((link) => link.provider === 'zephyr')?.externalId
            ?? fallbackLink.externalId
            ?? remote.id
            ?? '',
        clearedDirtyIds: [node.id],
    }
}
