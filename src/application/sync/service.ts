import type { RootState, TestCase, TestCaseLink } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import type { ZephyrImportApplyResult, ZephyrImportPreview, ZephyrImportRequest } from './zephyrImport'
import type { ZephyrPublishPreview, ZephyrPublishResult } from './zephyrPublish'

export async function resolvePullLink(
    test: TestCase,
    pullByLink: (link: TestCaseLink) => Promise<ProviderTest>
): Promise<ProviderTest | null> {
    const zephyr = test.links.find((link) => link.provider === 'zephyr')
    if (zephyr) return pullByLink(zephyr)
    const allure = test.links.find((link) => link.provider === 'allure')
    if (allure) return pullByLink(allure)
    return null
}

export interface SyncService {
    pullByLink(link: TestCaseLink): Promise<ProviderTest>
    pushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }>
    pullPreferZephyr(test: TestCase): Promise<ProviderTest | null>
    previewZephyrImport(state: RootState, request: ZephyrImportRequest): Promise<ZephyrImportPreview>
    applyZephyrImport(state: RootState, preview: ZephyrImportPreview): ZephyrImportApplyResult
    previewZephyrPublish(state: RootState, tests: TestCase[], selectionLabel: string): Promise<ZephyrPublishPreview>
    publishZephyrPreview(state: RootState, preview: ZephyrPublishPreview): Promise<ZephyrPublishResult>
    twoWaySync(state: RootState): Promise<void>
}
