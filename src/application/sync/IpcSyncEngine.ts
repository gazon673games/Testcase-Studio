import type { RootState, TestCase, TestCaseLink } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import {
    applyZephyrImportPreview,
    buildZephyrImportPreview,
    buildZephyrImportQuery,
    type ZephyrImportApplyResult,
    type ZephyrImportPreview,
    type ZephyrImportRequest,
} from './zephyrImport'
import {
    buildZephyrPublishPreview,
    type ZephyrPublishPreview,
    type ZephyrPublishResult,
} from './zephyrPublish'
import type { SyncText } from './text'
import type { SyncService } from './service'

export interface SyncFetchZephyrImportResponse {
    query: string
    remotes: ProviderTest[]
}

export interface SyncFetchZephyrPublishEntry {
    externalId: string
    remote?: ProviderTest
    error?: string
}

export interface SyncPublishZephyrPreviewResponse {
    state: RootState
    result: ZephyrPublishResult
}

export interface SyncTransport {
    syncPullByLink(link: TestCaseLink): Promise<ProviderTest>
    syncPushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }>
    syncTwoWaySync(state: RootState): Promise<RootState>
    syncFetchZephyrImport(request: ZephyrImportRequest): Promise<SyncFetchZephyrImportResponse>
    syncFetchZephyrPublish(externalIds: string[]): Promise<SyncFetchZephyrPublishEntry[]>
    syncPublishZephyrPreview(
        state: RootState,
        preview: ZephyrPublishPreview
    ): Promise<SyncPublishZephyrPreviewResponse>
}

export class IpcSyncEngine implements SyncService {
    constructor(
        private transport: SyncTransport,
        private text: SyncText
    ) {}

    async pullByLink(link: TestCaseLink): Promise<ProviderTest> {
        return this.transport.syncPullByLink(link)
    }

    async pushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }> {
        return this.transport.syncPushTest(test, link, state)
    }

    async pullPreferZephyr(test: TestCase): Promise<ProviderTest | null> {
        const zephyr = test.links.find((link) => link.provider === 'zephyr')
        if (zephyr) return this.pullByLink(zephyr)

        const allure = test.links.find((link) => link.provider === 'allure')
        if (allure) return this.pullByLink(allure)

        return null
    }

    async previewZephyrImport(state: RootState, request: ZephyrImportRequest): Promise<ZephyrImportPreview> {
        const query = buildZephyrImportQuery(request)
        const response = await this.transport.syncFetchZephyrImport(request)
        return buildZephyrImportPreview(state, request, response.remotes, this.text, response.query || query)
    }

    applyZephyrImport(state: RootState, preview: ZephyrImportPreview): ZephyrImportApplyResult {
        return applyZephyrImportPreview(state, preview, this.text)
    }

    async previewZephyrPublish(
        state: RootState,
        tests: TestCase[],
        selectionLabel: string
    ): Promise<ZephyrPublishPreview> {
        const remoteIds = [...new Set(
            tests
                .map((test) => test.links.find((link) => link.provider === 'zephyr')?.externalId ?? test.meta?.params?.key ?? '')
                .map((item) => String(item).trim())
                .filter(Boolean)
        )]

        const remoteEntries = await this.transport.syncFetchZephyrPublish(remoteIds)
        const remoteMap = new Map<string, ProviderTest | Error>()
        for (const entry of remoteEntries) {
            if (entry.remote) {
                remoteMap.set(entry.externalId, entry.remote)
                continue
            }

            remoteMap.set(
                entry.externalId,
                new Error(entry.error || `Failed to load remote test case ${entry.externalId}`)
            )
        }

        return buildZephyrPublishPreview(state, tests, remoteMap, selectionLabel, this.text)
    }

    async publishZephyrPreview(state: RootState, preview: ZephyrPublishPreview): Promise<ZephyrPublishResult> {
        const response = await this.transport.syncPublishZephyrPreview(state, preview)
        replaceRootState(state, response.state)
        return response.result
    }

    async twoWaySync(state: RootState): Promise<void> {
        const nextState = await this.transport.syncTwoWaySync(state)
        replaceRootState(state, nextState)
    }
}

function replaceRootState(target: RootState, source: RootState) {
    target.root = source.root
    target.sharedSteps = source.sharedSteps
}
