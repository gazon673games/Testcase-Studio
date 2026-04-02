import * as React from 'react'
import type { SharedStep, Step, TestCase } from '@core/domain'
import type { SelectionSummary } from './selectionSummary'
import { ScopeOverviewPanel } from './ScopeOverviewPanel'

const TestEditor = React.lazy(() =>
    import('../testEditor/TestEditor').then((module) => ({ default: module.TestEditor }))
)
import type { TestEditorHandle } from '../testEditor/TestEditor'

type ImportDestination = {
    label: string
}

type PublishSelection = {
    label: string
    tests: TestCase[]
}

type Props = {
    editorRef: React.MutableRefObject<TestEditorHandle | null>
    selectedTest: TestCase | null
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    focusStepId: string | null
    previewMode: 'preview' | 'raw'
    selectionSummary: SelectionSummary
    importDestination: ImportDestination
    publishSelection: PublishSelection
    loadingEditorLabel: string
    onUpdateTest(
        testId: string,
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>>
    ): void
    onAddSharedStep(): Promise<string | null> | string | null
    onAddSharedStepFromStep(step: Step, name?: string): Promise<string | null> | string | null
    onUpdateSharedStep(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void
    onDeleteSharedStep(sharedId: string): void
    onInsertSharedReference(testId: string, sharedId: string): void
    onOpenStep(testId: string, stepId: string): void
    onOpenTest(testId: string): void
    onOpenImport(): void
    onOpenPublish(): void
    onAddFolder(): void
    onAddTest(): void
}

export function AppShellRightPane({
    editorRef,
    selectedTest,
    allTests,
    sharedSteps,
    focusStepId,
    previewMode,
    selectionSummary,
    importDestination,
    publishSelection,
    loadingEditorLabel,
    onUpdateTest,
    onAddSharedStep,
    onAddSharedStepFromStep,
    onUpdateSharedStep,
    onDeleteSharedStep,
    onInsertSharedReference,
    onOpenStep,
    onOpenTest,
    onOpenImport,
    onOpenPublish,
    onAddFolder,
    onAddTest,
}: Props) {
    if (selectedTest) {
        return (
            <React.Suspense fallback={<div className="app-shell__editor-loading">{loadingEditorLabel}</div>}>
                <TestEditor
                    ref={editorRef}
                    test={selectedTest}
                    onChange={(patch) => onUpdateTest(selectedTest.id, patch)}
                    focusStepId={focusStepId}
                    allTests={allTests}
                    sharedSteps={sharedSteps}
                    onAddSharedStep={onAddSharedStep}
                    onAddSharedStepFromStep={onAddSharedStepFromStep}
                    onUpdateSharedStep={onUpdateSharedStep}
                    onDeleteSharedStep={onDeleteSharedStep}
                    onInsertSharedReference={(sharedId: string) => onInsertSharedReference(selectedTest.id, sharedId)}
                    onOpenStep={onOpenStep}
                    onOpenTest={onOpenTest}
                    previewMode={previewMode}
                />
            </React.Suspense>
        )
    }

    return (
        <ScopeOverviewPanel
            summary={selectionSummary}
            importDestinationLabel={importDestination.label}
            publishSelectionLabel={publishSelection.label}
            publishCount={publishSelection.tests.length}
            onOpenImport={onOpenImport}
            onOpenPublish={onOpenPublish}
            onAddFolder={onAddFolder}
            onAddTest={onAddTest}
        />
    )
}
