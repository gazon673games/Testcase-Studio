import * as React from 'react'
import './TestEditor.css'
import type { SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'
import './panels/MetaParamsPanel.css'
import './panels/AttachmentsPanel.css'
import StepsPanel from './panels/steps/StepsPanel'
import { TestEditorHero } from './TestEditorHero'
import { TestEditorSecondaryPanels } from './TestEditorSecondaryPanels'
import { TestEditorSharedDrawer } from './TestEditorSharedDrawer'
import { useTestEditorLinks } from './useTestEditorLinks'
import { useTestEditorReferenceTools } from './useTestEditorReferenceTools'
import { useTestEditorSharedLibrary } from './useTestEditorSharedLibrary'
import { useTestEditorSummary } from './useTestEditorSummary'
import { useUiPreferences } from '../preferences'
import { useStoredToggle } from '../hooks/useStoredToggle'

type Props = {
    test: TestCase
    onChange: (
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ) => void
    focusStepId?: string | null
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    onAddSharedStep(): Promise<string | null> | string | null
    onAddSharedStepFromStep(step: Step, name?: string): Promise<string | null> | string | null
    onUpdateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void | Promise<void>
    onDeleteSharedStep(sharedId: string): void | Promise<void>
    onInsertSharedReference(sharedId: string): void | Promise<void>
    onOpenStep(testId: string, stepId: string): void
    onOpenTest(testId: string): void
    previewMode: 'raw' | 'preview'
}

export type TestEditorHandle = { commit(): void }

export const TestEditor = React.forwardRef<TestEditorHandle, Props>(function TestEditor(
    {
        test,
        onChange,
        focusStepId,
        allTests,
        sharedSteps,
        onAddSharedStep,
        onAddSharedStepFromStep,
        onUpdateSharedStep,
        onDeleteSharedStep,
        onInsertSharedReference,
        onOpenStep,
        onOpenTest,
        previewMode,
    }: Props,
    ref
) {
    const { t } = useUiPreferences()
    const [showDetails, setShowDetails] = useStoredToggle('test-editor.show-details', true)
    const [showMeta, setShowMeta] = useStoredToggle('test-editor.show-meta', false)
    const [showAttachments, setShowAttachments] = useStoredToggle('test-editor.show-attachments', false)
    const [showLinks, setShowLinks] = useStoredToggle('test-editor.show-links', false)
    const [showSharedLibrary, setShowSharedLibrary] = useStoredToggle('test-editor.show-shared-library.v2', false)
    const [activeEditorApi, setActiveEditorApi] = React.useState<MarkdownEditorApi | null>(null)

    const { zephyrLink, allureLink, upsertLink } = useTestEditorLinks({ test, onChange })
    const { resolveRefs, inspectRefs, insertIntoActiveEditor } = useTestEditorReferenceTools({
        allTests,
        sharedSteps,
        activeEditorApi,
    })
    const {
        selectedSharedId,
        focusSharedStepId,
        openResolvedRef,
        openUsage,
        handleAddShared,
        handleCreateSharedFromStep,
        handleOpenShared,
        handleSelectShared,
        handleDeleteShared,
    } = useTestEditorSharedLibrary({
        sharedSteps,
        setShowSharedLibrary,
        onAddSharedStep,
        onAddSharedStepFromStep,
        onDeleteSharedStep,
        onOpenStep,
        onOpenTest,
    })
    const { externalLinksCount, summaryItems } = useTestEditorSummary({
        test,
        zephyrLink,
        allureLink,
        t,
    })

    React.useImperativeHandle(ref, () => ({ commit: () => {} }), [])

    return (
        <div className={`test-editor-shell ${showSharedLibrary ? 'with-drawer' : ''}`}>
            <div className="test-editor-main">
                <div className="test-editor">
                    <TestEditorHero
                        testName={test.name}
                        summaryItems={summaryItems}
                        showSharedLibrary={showSharedLibrary}
                        sharedStepsCount={sharedSteps.length}
                        onToggleSharedLibrary={() => setShowSharedLibrary((current) => !current)}
                        onChangeName={(value) => onChange({ name: value })}
                    />

                    <StepsPanel
                        owner={{ type: 'test', id: test.id }}
                        steps={test.steps}
                        onChange={(next) => onChange({ steps: next })}
                        allTests={allTests}
                        sharedSteps={sharedSteps}
                        resolveRefs={resolveRefs}
                        inspectRefs={inspectRefs}
                        onOpenRef={openResolvedRef}
                        focusStepId={focusStepId}
                        previewMode={previewMode}
                        onApply={() => {}}
                        onActivateEditorApi={setActiveEditorApi}
                        onCreateSharedFromStep={handleCreateSharedFromStep}
                        onOpenShared={handleOpenShared}
                        onInsertText={insertIntoActiveEditor}
                    />
                    <TestEditorSecondaryPanels
                        test={test}
                        allTests={allTests}
                        sharedSteps={sharedSteps}
                        previewMode={previewMode}
                        showDetails={showDetails}
                        showMeta={showMeta}
                        showAttachments={showAttachments}
                        showLinks={showLinks}
                        externalLinksCount={externalLinksCount}
                        zephyrLink={zephyrLink}
                        allureLink={allureLink}
                        resolveRefs={resolveRefs}
                        inspectRefs={inspectRefs}
                        onOpenRef={openResolvedRef}
                        onChange={onChange}
                        onActivateEditorApi={setActiveEditorApi}
                        onToggleDetails={() => setShowDetails((current) => !current)}
                        onToggleMeta={() => setShowMeta((current) => !current)}
                        onToggleAttachments={() => setShowAttachments((current) => !current)}
                        onToggleLinks={() => setShowLinks((current) => !current)}
                        onChangeZephyrLink={(value) => upsertLink('zephyr', value)}
                        onChangeAllureLink={(value) => upsertLink('allure', value)}
                    />
                </div>
            </div>

            <TestEditorSharedDrawer
                open={showSharedLibrary}
                sharedSteps={sharedSteps}
                selectedSharedId={selectedSharedId}
                focusStepId={focusSharedStepId}
                allTests={allTests}
                resolveRefs={resolveRefs}
                inspectRefs={inspectRefs}
                onOpenRef={openResolvedRef}
                onActivateEditorApi={setActiveEditorApi}
                onClose={() => setShowSharedLibrary(false)}
                onSelectShared={handleSelectShared}
                onAddShared={handleAddShared}
                onUpdateShared={onUpdateSharedStep}
                onDeleteShared={handleDeleteShared}
                onInsertShared={onInsertSharedReference}
                onOpenUsage={openUsage}
                onOpenShared={handleOpenShared}
                onInsertText={insertIntoActiveEditor}
            />
        </div>
    )
})
