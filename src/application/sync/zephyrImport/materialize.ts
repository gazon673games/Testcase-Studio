import { mkTest, normalizeTestCase, nowISO, type TestCase, type TestCaseLink } from '@core/domain'
import { fromProviderPayload } from '@providers/mappers'
import type { ProviderTest } from '@providers/types'
import {
    applyImportMarkers,
    buildImportedMeta,
    buildImportManagedSignature,
    getImportMetaKeys,
    getManagedMetaKeys,
    IMPORT_REMOTE_KEY_KEY,
} from './markers'
import { dedupeTests, extractTrailingDigits, normalizeZephyrRef } from './shared'

export function materializeImportedTest(remote: ProviderTest, existing?: TestCase): TestCase {
    const patch = fromProviderPayload(remote, existing?.steps ?? [])
    const base = existing ? normalizeTestCase(existing) : mkTest(patch.name, patch.description)
    const previousImportedKeys = getImportMetaKeys(existing) ?? []
    const nextImportedKeys = getManagedMetaKeys({ ...base, meta: patch.meta } as TestCase)

    const next: TestCase = normalizeTestCase({
        ...base,
        id: existing?.id ?? base.id,
        name: patch.name,
        description: patch.description,
        steps: patch.steps,
        attachments: patch.attachments,
        links: upsertZephyrLink(existing?.links ?? base.links, remote.id),
        updatedAt: patch.updatedAt ?? nowISO(),
        meta: buildImportedMeta(existing?.meta, patch.meta, previousImportedKeys, nextImportedKeys, remote.updatedAt),
        exportCfg: existing?.exportCfg ?? base.exportCfg,
    })

    const signature = buildImportManagedSignature(next, nextImportedKeys)
    applyImportMarkers(next.meta, {
        signature,
        metaKeys: nextImportedKeys,
        remoteKey: remote.id,
        remoteUpdatedAt: remote.updatedAt,
    })

    return normalizeTestCase(next)
}

export function findLocalMatches(remote: ProviderTest, tests: TestCase[]): TestCase[] {
    const remoteKey = normalizeZephyrRef(remote.id)
    const remoteDigits = extractTrailingDigits(remoteKey)
    const out: TestCase[] = []

    for (const test of tests) {
        const zephyrLink = test.links.find((link) => link.provider === 'zephyr')
        const linkValue = normalizeZephyrRef(zephyrLink?.externalId)
        const linkDigits = extractTrailingDigits(linkValue)
        const metaKey = normalizeZephyrRef(test.meta?.params?.key)
        const metaDigits = extractTrailingDigits(test.meta?.params?.keyNumber ?? metaKey)
        const importKey = normalizeZephyrRef(test.meta?.params?.[IMPORT_REMOTE_KEY_KEY])

        if (
            (linkValue && linkValue === remoteKey) ||
            (metaKey && metaKey === remoteKey) ||
            (importKey && importKey === remoteKey) ||
            (remoteDigits && ((linkDigits && linkDigits === remoteDigits) || (metaDigits && metaDigits === remoteDigits)))
        ) {
            out.push(test)
        }
    }

    return dedupeTests(out)
}

function upsertZephyrLink(existing: TestCaseLink[], remoteId: string): TestCaseLink[] {
    return [
        ...existing.filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId: remoteId },
    ]
}
