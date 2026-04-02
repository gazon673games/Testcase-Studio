import * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'
import type { SharedStep, TestCase, TestMeta } from '@core/domain'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'
import { ParamsPanel } from './panels/MetaParamsPanel'
import { AttachmentsPanel } from './panels/AttachmentsPanel'
import DetailsPanel from './panels/DetailsPanel'
import { TestEditorLinksCard } from './TestEditorLinksCard'
import { TestEditorSectionHeader } from './TestEditorSectionHeader'
import { useUiPreferences } from '../preferences'

type Props = {
    test: TestCase
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    previewMode: 'raw' | 'preview'
    showDetails: boolean
    showMeta: boolean
    showAttachments: boolean
    showLinks: boolean
    externalLinksCount: number
    zephyrLink: string
    allureLink: string
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onChange: (
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ) => void
    onActivateEditorApi(api: MarkdownEditorApi | null): void
    onToggleDetails(): void
    onToggleMeta(): void
    onToggleAttachments(): void
    onToggleLinks(): void
    onChangeZephyrLink(value: string): void
    onChangeAllureLink(value: string): void
}

export function TestEditorSecondaryPanels({
    test,
    allTests,
    sharedSteps,
    previewMode,
    showDetails,
    showMeta,
    showAttachments,
    showLinks,
    externalLinksCount,
    zephyrLink,
    allureLink,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onChange,
    onActivateEditorApi,
    onToggleDetails,
    onToggleMeta,
    onToggleAttachments,
    onToggleLinks,
    onChangeZephyrLink,
    onChangeAllureLink,
}: Props) {
    const { t } = useUiPreferences()

    return (
        <>
            <TestEditorSectionHeader
                title={t('editor.details')}
                open={showDetails}
                onToggle={onToggleDetails}
            />
            {showDetails && (
                <DetailsPanel
                    description={test.description ?? ''}
                    onChangeDescription={(value) => onChange({ description: value })}
                    meta={(test.meta as TestMeta) ?? { tags: [] }}
                    onChangeMeta={(nextMeta) => onChange({ meta: nextMeta })}
                    allTests={allTests}
                    sharedSteps={sharedSteps}
                    resolveRefs={resolveRefs}
                    inspectRefs={inspectRefs}
                    previewMode={previewMode}
                    onOpenRef={onOpenRef}
                    onActivateEditorApi={onActivateEditorApi}
                />
            )}

            <TestEditorSectionHeader
                title={t('editor.parameters')}
                open={showMeta}
                onToggle={onToggleMeta}
            />
            {showMeta && (
                <ParamsPanel
                    meta={(test.meta as TestMeta) ?? { tags: [] }}
                    onChange={(nextMeta) => onChange({ meta: nextMeta })}
                />
            )}

            <TestEditorSectionHeader
                title={t('editor.attachments')}
                open={showAttachments}
                count={test.attachments?.length ?? 0}
                onToggle={onToggleAttachments}
            />
            {showAttachments && (
                <AttachmentsPanel
                    attachments={test.attachments ?? []}
                    onChange={(next) => onChange({ attachments: next })}
                />
            )}

            <TestEditorSectionHeader
                title={t('editor.integrations')}
                open={showLinks}
                count={externalLinksCount}
                onToggle={onToggleLinks}
            />
            {showLinks && (
                <TestEditorLinksCard
                    zephyrLink={zephyrLink}
                    allureLink={allureLink}
                    onChangeZephyr={onChangeZephyrLink}
                    onChangeAllure={onChangeAllureLink}
                />
            )}
        </>
    )
}
