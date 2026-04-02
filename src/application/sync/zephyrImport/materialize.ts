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
import { extractTrailingDigits, normalizeZephyrRef } from './shared'

export type LocalMatchIndex = {
    testsById: Map<string, TestCase>
    keysByTestId: Map<string, { refs: string[]; digits: string[] }>
    byRef: Map<string, Set<string>>
    byDigits: Map<string, Set<string>>
}

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

export function buildLocalMatchIndex(tests: TestCase[]): LocalMatchIndex {
    const index: LocalMatchIndex = {
        testsById: new Map(),
        keysByTestId: new Map(),
        byRef: new Map(),
        byDigits: new Map(),
    }

    for (const test of tests) {
        upsertLocalMatch(index, test)
    }

    return index
}

export function upsertLocalMatch(index: LocalMatchIndex, test: TestCase) {
    removeLocalMatch(index, test.id)
    index.testsById.set(test.id, test)

    const { refs, digits } = collectMatchKeys(test)
    index.keysByTestId.set(test.id, { refs, digits })
    refs.forEach((value) => rememberMatch(index.byRef, value, test.id))
    digits.forEach((value) => rememberMatch(index.byDigits, value, test.id))
}

export function findLocalMatches(remote: ProviderTest, index: LocalMatchIndex): TestCase[] {
    const ids = new Set<string>()
    const remoteKey = normalizeZephyrRef(remote.id)
    const remoteDigits = extractTrailingDigits(remoteKey)

    collectMatches(index.byRef, remoteKey, ids)
    collectMatches(index.byDigits, remoteDigits, ids)

    return [...ids]
        .map((id) => index.testsById.get(id))
        .filter((test): test is TestCase => Boolean(test))
}

function upsertZephyrLink(existing: TestCaseLink[], remoteId: string): TestCaseLink[] {
    return [
        ...existing.filter((link) => link.provider !== 'zephyr'),
        { provider: 'zephyr', externalId: remoteId },
    ]
}

function removeLocalMatch(index: LocalMatchIndex, testId: string) {
    const keys = index.keysByTestId.get(testId)
    if (!keys) return

    const { refs, digits } = keys
    refs.forEach((value) => forgetMatch(index.byRef, value, testId))
    digits.forEach((value) => forgetMatch(index.byDigits, value, testId))
    index.testsById.delete(testId)
    index.keysByTestId.delete(testId)
}

function collectMatchKeys(test: TestCase) {
    const zephyrLink = test.links.find((link) => link.provider === 'zephyr')
    const linkValue = normalizeZephyrRef(zephyrLink?.externalId)
    const metaKey = normalizeZephyrRef(test.meta?.params?.key)
    const importKey = normalizeZephyrRef(test.meta?.params?.[IMPORT_REMOTE_KEY_KEY])
    const linkDigits = extractTrailingDigits(linkValue)
    const metaDigits = extractTrailingDigits(test.meta?.params?.keyNumber ?? metaKey)

    return {
        refs: [...new Set([linkValue, metaKey, importKey].filter(Boolean))],
        digits: [...new Set([linkDigits, metaDigits].filter(Boolean))],
    }
}

function rememberMatch(index: Map<string, Set<string>>, key: string, testId: string) {
    const current = index.get(key)
    if (current) {
        current.add(testId)
        return
    }
    index.set(key, new Set([testId]))
}

function forgetMatch(index: Map<string, Set<string>>, key: string, testId: string) {
    const current = index.get(key)
    if (!current) return
    current.delete(testId)
    if (!current.size) index.delete(key)
}

function collectMatches(index: Map<string, Set<string>>, key: string, out: Set<string>) {
    if (!key) return
    const matches = index.get(key)
    if (!matches) return
    matches.forEach((id) => out.add(id))
}
