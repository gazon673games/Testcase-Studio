import * as React from 'react'
import type { MessageKey } from '../preferences'
import type { TestCase } from '@core/domain'

type Translator = (key: MessageKey, params?: Record<string, string | number>) => string

type Options = {
    test: TestCase
    zephyrLink: string
    allureLink: string
    t: Translator
}

export function useTestEditorSummary({ test, zephyrLink, allureLink, t }: Options) {
    const sharedReferenceCount = React.useMemo(
        () => (test.steps ?? []).filter((step) => step.usesShared).length,
        [test.steps]
    )
    const tagsCount = test.meta?.tags?.length ?? 0
    const externalLinksCount = (zephyrLink ? 1 : 0) + (allureLink ? 1 : 0)

    const summaryItems = React.useMemo(
        () =>
            [
                t('editor.summary.steps', { count: test.steps.length }),
                sharedReferenceCount ? t('editor.summary.sharedRefs', { count: sharedReferenceCount }) : '',
                test.attachments?.length ? t('editor.summary.attachments', { count: test.attachments.length }) : '',
                tagsCount ? t('editor.summary.tags', { count: tagsCount }) : '',
                zephyrLink ? t('editor.summary.linkedZephyr') : '',
                allureLink ? t('editor.summary.linkedAllure') : '',
            ].filter(Boolean),
        [allureLink, sharedReferenceCount, t, tagsCount, test.attachments?.length, test.steps.length, zephyrLink]
    )

    return {
        externalLinksCount,
        summaryItems,
    }
}
