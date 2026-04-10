import type { TestCase } from '@core/domain'
import { getZephyrTestIntegration, setZephyrTestIntegration } from './zephyrModel'

export function isZephyrHtmlPartsEnabled(test: Pick<TestCase, 'integration'> | undefined): boolean {
    return Boolean(getZephyrTestIntegration(test)?.options?.parseHtmlParts)
}

export function setZephyrHtmlPartsEnabled(test: TestCase, enabled: boolean): TestCase {
    return setZephyrTestIntegration(test, {
        ...(getZephyrTestIntegration(test) ?? {}),
        options: {
            ...(getZephyrTestIntegration(test)?.options ?? {}),
            parseHtmlParts: enabled,
        },
    })
}

export function preserveZephyrHtmlPartsFlag(existing: Pick<TestCase, 'integration'> | undefined, next: TestCase): TestCase {
    if (!isZephyrHtmlPartsEnabled(existing)) return next
    return setZephyrHtmlPartsEnabled(next, true)
}
