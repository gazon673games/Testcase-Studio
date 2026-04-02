import * as React from 'react'
import type { ResolvedWikiRef, SharedUsage } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'
import SharedLibraryPanel from './panels/sharedLibrary/SharedLibraryPanel'
import { useUiPreferences } from '../preferences'

type Props = {
    open: boolean
    sharedSteps: SharedStep[]
    selectedSharedId: string | null
    focusStepId?: string | null
    allTests: TestCase[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onClose(): void
    onSelectShared(id: string): void
    onAddShared(): void | Promise<void>
    onUpdateShared(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void | Promise<void>
    onDeleteShared(sharedId: string): void | Promise<void>
    onInsertShared(sharedId: string): void | Promise<void>
    onOpenUsage(usage: SharedUsage): void
    onOpenShared(sharedId: string, stepId?: string): void
    onInsertText?: (text: string) => void | Promise<void>
}

export function TestEditorSharedDrawer({
    open,
    sharedSteps,
    selectedSharedId,
    focusStepId,
    allTests,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateEditorApi,
    onClose,
    onSelectShared,
    onAddShared,
    onUpdateShared,
    onDeleteShared,
    onInsertShared,
    onOpenUsage,
    onOpenShared,
    onInsertText,
}: Props) {
    const { t } = useUiPreferences()

    if (!open) return null

    return (
        <aside className="editor-drawer" aria-label={t('editor.sharedLibraryDrawer')}>
            <SharedLibraryPanel
                variant="drawer"
                extraHeaderAction={(
                    <button type="button" className="btn-small" onClick={onClose}>
                        {t('editor.close')}
                    </button>
                )}
                sharedSteps={sharedSteps}
                selectedSharedId={selectedSharedId}
                focusStepId={focusStepId}
                allTests={allTests}
                resolveRefs={resolveRefs}
                inspectRefs={inspectRefs}
                onOpenRef={onOpenRef}
                onActivateEditorApi={onActivateEditorApi}
                onSelectShared={onSelectShared}
                onAddShared={onAddShared}
                onUpdateShared={onUpdateShared}
                onDeleteShared={onDeleteShared}
                onInsertShared={onInsertShared}
                onOpenUsage={onOpenUsage}
                onOpenShared={onOpenShared}
                onInsertText={onInsertText}
            />
        </aside>
    )
}
