import { nowISO, type TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import { buildPublishSignature, PUBLISH_AT_KEY, PUBLISH_REMOTE_KEY, PUBLISH_SIGNATURE_KEY, safeString } from './common'

export function applyPublishSuccess(test: TestCase, externalId: string, payload: ProviderTest) {
    test.links = [
        ...(test.links ?? []).filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId },
    ]

    test.meta = test.meta ?? { tags: [], params: {} }
    test.meta.params = test.meta.params ?? {}
    test.meta.params.key = externalId

    const projectKey = safeString(payload.extras?.projectKey)
    if (projectKey) test.meta.params.projectKey = projectKey

    const folder = safeString(payload.extras?.folder)
    if (folder) test.meta.params.folder = folder

    test.meta.params[PUBLISH_SIGNATURE_KEY] = buildPublishSignature(payload)
    test.meta.params[PUBLISH_REMOTE_KEY] = externalId
    test.meta.params[PUBLISH_AT_KEY] = nowISO()
    test.updatedAt = nowISO()
}
