import { nowISO, type TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import { buildPublishSignature, PUBLISH_AT_KEY, PUBLISH_REMOTE_KEY, PUBLISH_SIGNATURE_KEY, safeString } from './common'

export function applyPublishSuccess(test: TestCase, externalId: string, payload: ProviderTest) {
    test.links = [
        ...(test.links ?? []).filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId },
    ]

    const details = (test.details ?? test.meta ?? { tags: [], attributes: {}, params: {} })
    details.attributes = details.attributes ?? details.params ?? {}
    details.params = details.attributes
    details.external = {
        ...(details.external ?? {}),
        key: externalId,
    }
    test.details = details
    test.meta = details

    const projectKey = safeString(payload.extras?.projectKey)
    if (projectKey) {
        details.external = {
            ...(details.external ?? {}),
            projectKey,
        }
    }

    const folder = safeString(payload.extras?.folder)
    if (folder) details.folder = folder

    details.attributes[PUBLISH_SIGNATURE_KEY] = buildPublishSignature(payload)
    details.attributes[PUBLISH_REMOTE_KEY] = externalId
    details.attributes[PUBLISH_AT_KEY] = nowISO()
    test.updatedAt = nowISO()
}
