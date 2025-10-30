// @core/syncEngine.ts
import { materializeSharedSteps } from './shared'
import type { RootState, TestCase, TestCaseLink, ProviderKind } from './domain'
import type { ITestProvider, PushOptions, ProviderTest } from '@providers/types'
import { buildExport } from './export'
import { toProviderPayload, fromProviderPayload } from '@providers/mappers'

export class SyncEngine {
    constructor(private providers: Record<ProviderKind, ITestProvider>) {}

    private providerBy(kind: ProviderKind) { return this.providers[kind] }

    async pullByLink(link: TestCaseLink): Promise<ProviderTest> {
        const provider = this.providerBy(link.provider)
        return provider.getTestDetails(link.externalId, { includeAttachments: true })
    }

    async pushTest(test: TestCase, link: TestCaseLink, state?: RootState): Promise<{ externalId: string }> {
        const provider = this.providerBy(link.provider)
        const exp = buildExport(test, state)
        const payload = toProviderPayload(exp)
        return provider.upsertTest(payload, { pushAttachments: true })
    }

    async pullPreferZephyr(test: TestCase): Promise<ProviderTest | null> {
        const z = test.links.find(l => l.provider === 'zephyr')
        if (z) return this.pullByLink(z)
        const a = test.links.find(l => l.provider === 'allure')
        if (a) return this.pullByLink(a)
        return null
    }

    async twoWaySync(state: RootState): Promise<void> {
        const tests = state.root ? this.collectTests(state) : []
        for (const t of tests) {
            for (const link of t.links) {
                const provider = this.providers[link.provider]
                const remote = await provider.getTestDetails(link.externalId, {})
                if (!remote.updatedAt || (t.updatedAt > remote.updatedAt)) {
                    const exp = buildExport(t, state)
                    await provider.upsertTest(toProviderPayload(exp), { pushAttachments: true } as PushOptions)
                } else {
                    const patch = fromProviderPayload(remote)
                    t.name = patch.name
                    t.description = patch.description
                    t.steps = patch.steps
                    t.attachments = patch.attachments
                    t.updatedAt = patch.updatedAt!
                }
            }
        }
    }

    private collectTests(state: RootState): TestCase[] {
        const acc: TestCase[] = []
        const walk = (node: any) => {
            if (!node) return
            if (Array.isArray(node.children)) node.children.forEach(walk)
            else if (node.steps && node.attachments) acc.push(node)
        }
        walk(state.root)
        return acc
    }
}
