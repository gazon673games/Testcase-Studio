import {
    SyncEngine,
    buildZephyrImportQuery,
    createSyncText,
    type SyncFetchZephyrPublishEntry,
    type ZephyrImportRequest,
    type ZephyrPublishPreview,
} from '../../application/sync/index.js'
import type { RootState, TestCase, TestCaseLink } from '../../core/domain.js'
import { AllureStubProvider } from '../../providers/allure.stub.js'
import type { ITestProvider } from '../../providers/types.js'
import { ZephyrHttpProvider } from '../../providers/zephyr/zephyr.http.js'
import { createMainZephyrClient } from './handlerZephyrClient.js'

function createMainSyncContext() {
    const zephyr = new ZephyrHttpProvider(createMainZephyrClient())
    const sync = new SyncEngine(
        {
            zephyr,
            allure: new AllureStubProvider(),
        },
        createSyncText((key) => key)
    )

    return { sync, zephyr }
}

async function collectZephyrImportRefs(
    provider: ITestProvider,
    query: string,
    request: Pick<ZephyrImportRequest, 'mode' | 'refs' | 'maxResults'>
) {
    if (request.mode === 'keys') {
        return [...new Set((request.refs ?? []).map((ref) => String(ref).trim()).filter(Boolean))]
    }

    if (!provider.searchTestsByQuery) {
        throw new Error('Current Zephyr provider does not support search import')
    }

    const refs = await provider.searchTestsByQuery(query, { maxResults: request.maxResults ?? 100 })
    return [...new Set(refs.map((item) => item.ref).filter(Boolean))]
}

export async function pullByLinkInMain(link: TestCaseLink) {
    const { sync } = createMainSyncContext()
    return sync.pullByLink(link)
}

export async function pushTestInMain(test: TestCase, link: TestCaseLink, state?: RootState) {
    const { sync } = createMainSyncContext()
    return sync.pushTest(test, link, state)
}

export async function twoWaySyncStateInMain(state: RootState) {
    const { sync } = createMainSyncContext()
    // Electron IPC already delivers an isolated state snapshot to main.
    await sync.twoWaySync(state)
    return state
}

export async function fetchZephyrImportInMain(request: ZephyrImportRequest) {
    const { zephyr } = createMainSyncContext()
    const query = buildZephyrImportQuery(request)
    const refs = await collectZephyrImportRefs(zephyr, query, request)

    const results = await Promise.allSettled(refs.map((ref) => zephyr.getTestDetails(ref)))

    const failed = results
        .map((r, i) => ({ r, ref: refs[i] }))
        .filter(({ r }) => r.status === 'rejected')
    if (failed.length > 0) {
        const details = failed
            .map(({ r, ref }) => `${ref}: ${r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : ''}`)
            .join(', ')
        throw new Error(`Failed to fetch ${failed.length} of ${refs.length} test(s): ${details}`)
    }

    const remotes = (results as PromiseFulfilledResult<Awaited<ReturnType<typeof zephyr.getTestDetails>>>[])
        .map((r) => r.value)
    return { query, remotes }
}

export async function fetchZephyrPublishInMain(externalIds: string[]): Promise<SyncFetchZephyrPublishEntry[]> {
    const { zephyr } = createMainSyncContext()
    const normalizedIds = [...new Set((externalIds ?? []).map((item) => String(item).trim()).filter(Boolean))]

    return await Promise.all(
        normalizedIds.map(async (externalId): Promise<SyncFetchZephyrPublishEntry> => {
            try {
                return {
                    externalId,
                    remote: await zephyr.getTestDetails(externalId),
                }
            } catch (error) {
                return {
                    externalId,
                    error: error instanceof Error ? error.message : String(error),
                }
            }
        })
    )
}

export async function publishZephyrPreviewInMain(state: RootState, preview: ZephyrPublishPreview) {
    const { sync } = createMainSyncContext()
    // Electron IPC already delivers an isolated state snapshot to main.
    const result = await sync.publishZephyrPreview(state, preview)
    return { state, result }
}
