import { nowISO, type TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'
import { getZephyrTestIntegration, setZephyrTestIntegration } from '@providers/zephyr/zephyrModel'
import { buildPublishSignature, PUBLISH_AT_KEY, PUBLISH_REMOTE_KEY, PUBLISH_SIGNATURE_KEY, safeString } from './common'

export function applyPublishSuccess(test: TestCase, externalId: string, payload: ProviderTest) {
    test.links = [
        ...(test.links ?? []).filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId },
    ]

    const details = test.details ?? { tags: [], attributes: {} }
    details.attributes = details.attributes ?? {}
    test.details = details

    const currentZephyr = getZephyrTestIntegration(test)
    const nextZephyr = {
        ...(currentZephyr ?? {}),
        remote: {
            ...(currentZephyr?.remote ?? {}),
            key: externalId,
        },
        publishState: {
            ...(currentZephyr?.publishState ?? {}),
            signature: buildPublishSignature(payload),
            remoteKey: externalId,
            publishedAt: nowISO(),
        },
    }

    const projectKey = safeString(payload.extras?.projectKey)
    if (projectKey) {
        nextZephyr.remote = {
            ...(nextZephyr.remote ?? {}),
            projectKey,
        }
    }

    const folder = safeString(payload.extras?.folder)
    if (folder) details.folder = folder

    setZephyrTestIntegration(test, nextZephyr)
    test.updatedAt = nowISO()
}
