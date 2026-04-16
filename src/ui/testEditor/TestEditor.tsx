import * as React from 'react'
import './TestEditor.css'
import type { SharedStep, Step, TestCase } from '@core/domain'
import { isZephyrHtmlPartsEnabled, setZephyrHtmlPartsEnabled } from '@core/zephyrHtmlParts'
import { getStoredTestAlias, NODE_ALIAS_PARAM_KEY, normalizeNodeAlias } from '@shared/treeAliases'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'
import './panels/MetaParamsPanel.css'
import './panels/AttachmentsPanel.css'
import StepsPanel from './panels/steps/StepsPanel'
import { TestEditorHero } from './TestEditorHero'
import { TestEditorSecondaryPanels } from './TestEditorSecondaryPanels'
import { TestEditorSharedDrawer } from './TestEditorSharedDrawer'
import { MarkdownReferenceDataProvider, useSharedMarkdownReferenceData } from './markdownEditor/MarkdownReferenceDataContext'
import { useTestEditorLinks } from './useTestEditorLinks'
import { useTestEditorReferenceTools } from './useTestEditorReferenceTools'
import { useTestEditorSharedLibrary } from './useTestEditorSharedLibrary'
import { useTestEditorSummary } from './useTestEditorSummary'
import { useUiPreferences } from '../preferences'
import { useStoredToggle } from '../hooks/useStoredToggle'

type Props = {
    test: TestCase
    sessionDraft?: TestCase | null
    onSessionDraftChange?(draft: TestCase | null): void
    onChange: (
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
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

export type TestEditorHandle = { commit(): boolean }

export const TestEditor = React.forwardRef<TestEditorHandle, Props>(function TestEditor(
    {
        test,
        sessionDraft,
        onSessionDraftChange,
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
    const [draftTest, setDraftTest] = React.useState(() => structuredClone(sessionDraft ?? test))
    const draftRevisionCounterRef = React.useRef(1)
    const currentDraftRevisionRef = React.useRef(1)
    const syncedDraftRevisionRef = React.useRef(sessionDraft ? 0 : 1)
    const latestDraftRef = React.useRef(draftTest)
    const latestSourceRef = React.useRef(test)
    const previousTestIdRef = React.useRef(test.id)

    const [showDetails, setShowDetails] = useStoredToggle('test-editor.show-details', true)
    const [showMeta, setShowMeta] = useStoredToggle('test-editor.show-meta', false)
    const [showAttachments, setShowAttachments] = useStoredToggle('test-editor.show-attachments', false)
    const [showLinks, setShowLinks] = useStoredToggle('test-editor.show-links', false)
    const [showSharedLibrary, setShowSharedLibrary] = useStoredToggle('test-editor.show-shared-library.v2', false)
    const [activeEditorApi, setActiveEditorApi] = React.useState<MarkdownEditorApi | null>(null)
    const markdownReferenceData = useSharedMarkdownReferenceData(allTests, sharedSteps)
    const stepOwner = React.useMemo(() => ({ type: 'test' as const, id: draftTest.id }), [draftTest.id])

    const replaceDraft = React.useCallback((nextDraft: TestCase, dirty: boolean) => {
        draftRevisionCounterRef.current += 1
        currentDraftRevisionRef.current = draftRevisionCounterRef.current
        syncedDraftRevisionRef.current = dirty ? draftRevisionCounterRef.current - 1 : draftRevisionCounterRef.current
        latestDraftRef.current = nextDraft
        setDraftTest(nextDraft)
        onSessionDraftChange?.(dirty ? nextDraft : null)
    }, [onSessionDraftChange])

    const applyDraftPatch = React.useCallback((
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'details' | 'attachments' | 'links' | 'integration'>>
    ) => {
        setDraftTest((current) => {
            const patchEntries = Object.entries(patch) as Array<[keyof typeof patch, (typeof patch)[keyof typeof patch]]>
            if (patchEntries.length === 0 || patchEntries.every(([key, value]) => Object.is(current[key], value))) {
                return current
            }

            const next = { ...current, ...patch }
            draftRevisionCounterRef.current += 1
            currentDraftRevisionRef.current = draftRevisionCounterRef.current
            latestDraftRef.current = next
            onSessionDraftChange?.(next)
            return next
        })
    }, [onSessionDraftChange])

    const { zephyrLink, allureLink, upsertLink } = useTestEditorLinks({ test: draftTest, onChange: applyDraftPatch })
    const { resolveRefs, inspectRefs, insertIntoActiveEditor } = useTestEditorReferenceTools({
        refCatalog: markdownReferenceData.refCatalog,
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
        test: draftTest,
        zephyrLink,
        allureLink,
        t,
    })
    const parseZephyrHtmlParts = isZephyrHtmlPartsEnabled(draftTest)
    const testAlias = getStoredTestAlias(draftTest.details) ?? ''

    React.useEffect(() => {
        const nextSource = test
        const switchedTest = previousTestIdRef.current !== nextSource.id
        const hasLocalEdits = currentDraftRevisionRef.current !== syncedDraftRevisionRef.current

        latestSourceRef.current = nextSource

        if (switchedTest) {
            previousTestIdRef.current = nextSource.id
            replaceDraft(structuredClone(sessionDraft ?? nextSource), Boolean(sessionDraft))
            return
        }

        if (!hasLocalEdits) {
            replaceDraft(structuredClone(sessionDraft ?? nextSource), Boolean(sessionDraft))
        }
    }, [replaceDraft, sessionDraft, test])

    const commitDraft = React.useCallback(() => {
        if (currentDraftRevisionRef.current === syncedDraftRevisionRef.current) return false

        const current = latestDraftRef.current
        syncedDraftRevisionRef.current = currentDraftRevisionRef.current
        onChange({
            name: current.name,
            description: current.description,
            steps: current.steps,
            details: current.details,
            integration: current.integration,
            attachments: current.attachments,
            links: current.links,
        })
        return true
    }, [onChange])

    const handleStepsChange = React.useCallback((next: Step[]) => {
        applyDraftPatch({ steps: next })
    }, [applyDraftPatch])

    const handleToggleParseZephyrHtmlParts = React.useCallback((value: boolean) => {
        applyDraftPatch({ integration: setZephyrHtmlPartsEnabled(structuredClone(latestDraftRef.current), value).integration })
    }, [applyDraftPatch])

    const handleChangeName = React.useCallback((value: string) => {
        applyDraftPatch({ name: value })
    }, [applyDraftPatch])

    const handleChangeAlias = React.useCallback((value: string) => {
        applyDraftPatch({ details: setTestAlias(latestDraftRef.current.details, value) })
    }, [applyDraftPatch])

    React.useImperativeHandle(ref, () => ({ commit: commitDraft }), [commitDraft])

    return (
        <MarkdownReferenceDataProvider value={markdownReferenceData}>
            <div className={`test-editor-shell ${showSharedLibrary ? 'with-drawer' : ''}`}>
                <div className="test-editor-main">
                    <div className="test-editor">
                        <TestEditorHero
                            testName={draftTest.name}
                            testAlias={testAlias}
                            summaryItems={summaryItems}
                            showSharedLibrary={showSharedLibrary}
                            sharedStepsCount={sharedSteps.length}
                            parseZephyrHtmlParts={parseZephyrHtmlParts}
                            onToggleSharedLibrary={() => setShowSharedLibrary((current) => !current)}
                            onToggleParseZephyrHtmlParts={handleToggleParseZephyrHtmlParts}
                            onChangeName={handleChangeName}
                            onChangeAlias={handleChangeAlias}
                        />

                        <StepsPanel
                            owner={stepOwner}
                            steps={draftTest.steps}
                            onChange={handleStepsChange}
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
                            test={draftTest}
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
                            onChange={applyDraftPatch}
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
        </MarkdownReferenceDataProvider>
    )
})

function setTestAlias(details: TestCase['details'], alias: string) {
    const normalizedAlias = normalizeNodeAlias(alias)
    const nextDetails = {
        ...(details ?? { tags: [], attributes: {} }),
        tags: [...(details?.tags ?? [])],
        attributes: { ...(details?.attributes ?? {}) },
    }

    if (normalizedAlias) nextDetails.attributes[NODE_ALIAS_PARAM_KEY] = normalizedAlias
    else delete nextDetails.attributes[NODE_ALIAS_PARAM_KEY]

    return nextDetails
}
