import * as React from 'react'
import type { ProviderKind, TestCase, TestCaseLink } from '@core/domain'

type Options = {
    test: TestCase
    onChange: (
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
    ) => void
}

export function useTestEditorLinks({ test, onChange }: Options) {
    const getLink = React.useCallback(
        (provider: ProviderKind) => (test.links ?? []).find((item) => item.provider === provider)?.externalId ?? '',
        [test.links]
    )

    const upsertLink = React.useCallback((provider: ProviderKind, externalId: string) => {
        const trimmed = (externalId ?? '').trim()
        const nextLinks: TestCaseLink[] = trimmed
            ? [...(test.links ?? []).filter((item) => item.provider !== provider), { provider, externalId: trimmed }]
            : (test.links ?? []).filter((item) => item.provider !== provider)
        onChange({ links: nextLinks })
    }, [onChange, test.links])

    return {
        zephyrLink: getLink('zephyr'),
        allureLink: getLink('allure'),
        upsertLink,
    }
}
