import * as React from 'react'
import type { Folder, SharedStep, Step, TestCase } from '@core/domain'
import type { SelectionSummary } from '../model/selectionSummary'
import { ScopeOverviewPanel } from './ScopeOverviewPanel'

const TestEditor = React.lazy(() =>
    import('../../testEditor/TestEditor').then((module) => ({ default: module.TestEditor }))
)
import type { TestEditorHandle } from '../../testEditor/TestEditor'

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
    selectedFolder: Folder | null
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
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
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
    onRenameFolder(folderId: string, value: string): void
    onSetFolderAlias(folderId: string, value: string | null): void
}

export function AppShellRightPane({
    editorRef,
    selectedTest,
    selectedFolder,
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
    onRenameFolder,
    onSetFolderAlias,
}: Props) {
    const sessionDraftsRef = React.useRef(new Map<string, TestCase>())
    const selectedTestId = selectedTest?.id ?? null

    React.useEffect(() => {
        const existingIds = new Set(allTests.map((test) => test.id))
        for (const id of [...sessionDraftsRef.current.keys()]) {
            if (!existingIds.has(id)) sessionDraftsRef.current.delete(id)
        }
    }, [allTests])

    const handleSessionDraftChange = React.useCallback((draft: TestCase | null) => {
        if (!selectedTestId) return
        if (draft) sessionDraftsRef.current.set(selectedTestId, draft)
        else sessionDraftsRef.current.delete(selectedTestId)
    }, [selectedTestId])

    const handleCommitTestChange = React.useCallback((
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
    ) => {
        if (!selectedTestId) return
        sessionDraftsRef.current.delete(selectedTestId)
        onUpdateTest(selectedTestId, patch)
    }, [onUpdateTest, selectedTestId])

    if (selectedTest) {
        return (
            <React.Suspense fallback={<div className="app-shell__editor-loading">{loadingEditorLabel}</div>}>
                <TestEditor
                    ref={editorRef}
                    test={selectedTest}
                    sessionDraft={sessionDraftsRef.current.get(selectedTest.id) ?? null}
                    onSessionDraftChange={handleSessionDraftChange}
                    onChange={handleCommitTestChange}
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
            selectedFolder={selectedFolder}
            summary={selectionSummary}
            importDestinationLabel={importDestination.label}
            publishSelectionLabel={publishSelection.label}
            publishCount={publishSelection.tests.length}
            onOpenImport={onOpenImport}
            onOpenPublish={onOpenPublish}
            onAddFolder={onAddFolder}
            onAddTest={onAddTest}
            onRenameFolder={onRenameFolder}
            onSetFolderAlias={onSetFolderAlias}
        />
    )
}
