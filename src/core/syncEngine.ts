import type { ProviderTest, ITestProvider, PushOptions } from '@providers/types'
import { fromProviderPayload, toProviderPayload } from '@providers/mappers'
import type { ProviderKind, RootState, TestCase, TestCaseLink } from './domain'
import { buildExport } from './export'

export class SyncEngine {
    constructor(private providers: Record<ProviderKind, ITestProvider>) {}

    private providerBy(kind: ProviderKind) {
        return this.providers[kind]
    }

    async pullByLink(link: TestCaseLink): Promise<ProviderTest> {
        const provider = this.providerBy(link.provider)
        return provider.getTestDetails(link.externalId, { includeAttachments: true })
    }

    async pushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }> {
        const provider = this.providerBy(link.provider)
        const exported = buildExport(test, state)
        return provider.upsertTest(toProviderPayload(exported), { pushAttachments: true })
    }

    async pullPreferZephyr(test: TestCase): Promise<ProviderTest | null> {
        const zephyr = test.links.find((link) => link.provider === 'zephyr')
        if (zephyr) return this.pullByLink(zephyr)

        const allure = test.links.find((link) => link.provider === 'allure')
        if (allure) return this.pullByLink(allure)

        return null
    }

    async twoWaySync(state: RootState): Promise<void> {
        const tests = state.root ? this.collectTests(state) : []
        for (const test of tests) {
            for (const link of test.links) {
                const provider = this.providers[link.provider]
                const remote = await provider.getTestDetails(link.externalId, {})
                if (!remote.updatedAt || test.updatedAt > remote.updatedAt) {
                    const exported = buildExport(test, state)
                    await provider.upsertTest(toProviderPayload(exported), { pushAttachments: true } as PushOptions)
                    continue
                }

                const patch = fromProviderPayload(remote, test.steps)
                test.name = patch.name
                test.description = patch.description
                test.steps = patch.steps
                test.attachments = patch.attachments
                test.meta = patch.meta
                test.updatedAt = patch.updatedAt ?? new Date().toISOString()
            }
        }
    }

    private collectTests(state: RootState): TestCase[] {
        const acc: TestCase[] = []
        const walk = (node: any) => {
            if (!node) return
            if (Array.isArray(node.children)) {
                node.children.forEach(walk)
                return
            }
            if (node.steps && node.attachments) acc.push(node)
        }
        walk(state.root)
        return acc
    }
}
