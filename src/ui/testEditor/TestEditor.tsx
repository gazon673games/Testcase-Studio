import * as React from 'react'
import './TestEditor.css'
import { buildRefCatalog, inspectWikiRefs, resolveRefsInText, type ResolvedWikiRef, type SharedUsage } from '@core/refs'
import type { ProviderKind, SharedStep, Step, TestCase, TestCaseLink, TestMeta } from '@core/domain'
import type { MarkdownEditorApi } from './markdownEditor/MarkdownEditor'
import { ParamsPanel } from './panels/MetaParamsPanel'
import './panels/MetaParamsPanel.css'
import { AttachmentsPanel } from './panels/AttachmentsPanel'
import './panels/AttachmentsPanel.css'
import DetailsPanel from './panels/DetailsPanel'
import SharedLibraryPanel from './panels/SharedLibraryPanel'
import StepsPanel from './panels/StepsPanel'

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
    }: Props,
    ref
) {
    const [showAttachments, setShowAttachments] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [showMeta, setShowMeta] = React.useState(false)
    const [showSharedLibrary, setShowSharedLibrary] = React.useState(true)
    const [selectedSharedId, setSelectedSharedId] = React.useState<string | null>(sharedSteps[0]?.id ?? null)
    const [focusSharedStepId, setFocusSharedStepId] = React.useState<string | null>(null)
    const [activeEditorApi, setActiveEditorApi] = React.useState<MarkdownEditorApi | null>(null)

    React.useEffect(() => {
        setShowAttachments(false)
        setShowDetails(false)
        setShowMeta(false)
    }, [test.id])

    React.useEffect(() => {
        if (!selectedSharedId && sharedSteps[0]) setSelectedSharedId(sharedSteps[0].id)
        if (selectedSharedId && !sharedSteps.some((item) => item.id === selectedSharedId)) {
            setSelectedSharedId(sharedSteps[0]?.id ?? null)
            setFocusSharedStepId(null)
        }
    }, [selectedSharedId, sharedSteps])

    const getLink = React.useCallback(
        (provider: ProviderKind) => (test.links ?? []).find((item) => item.provider === provider)?.externalId ?? '',
        [test.links]
    )

    const upsertLink = (provider: ProviderKind, externalId: string) => {
        const trimmed = (externalId ?? '').trim()
        const nextLinks: TestCaseLink[] = trimmed
            ? [...(test.links ?? []).filter((item) => item.provider !== provider), { provider, externalId: trimmed }]
            : (test.links ?? []).filter((item) => item.provider !== provider)
        onChange({ links: nextLinks })
    }

    const refCatalog = React.useMemo(() => buildRefCatalog(allTests, sharedSteps), [allTests, sharedSteps])
    const resolveRefs = React.useCallback((src: string) => resolveRefsInText(src, refCatalog), [refCatalog])
    const inspectRefs = React.useCallback((src: string) => inspectWikiRefs(src, refCatalog), [refCatalog])

    const insertIntoActiveEditor = React.useCallback(async (text: string) => {
        if (activeEditorApi) {
            activeEditorApi.insertText(text)
            activeEditorApi.focus()
            return
        }
        try {
            await navigator.clipboard.writeText(text)
        } catch {
            // clipboard fallback is best-effort only
        }
    }, [activeEditorApi])

    const openResolvedRef = React.useCallback((refInfo: ResolvedWikiRef) => {
        if (!refInfo.ok || !refInfo.ownerId) return
        if (refInfo.ownerType === 'shared') {
            setShowSharedLibrary(true)
            setSelectedSharedId(refInfo.ownerId)
            setFocusSharedStepId(refInfo.stepId ?? null)
            return
        }
        if (refInfo.stepId) onOpenStep(refInfo.ownerId, refInfo.stepId)
        else onOpenTest(refInfo.ownerId)
    }, [onOpenStep, onOpenTest])

    const openUsage = React.useCallback((usage: SharedUsage) => {
        if (usage.ownerType === 'shared') {
            setShowSharedLibrary(true)
            setSelectedSharedId(usage.ownerId)
            setFocusSharedStepId(usage.sourceStepId ?? null)
            return
        }
        if (usage.sourceStepId) onOpenStep(usage.ownerId, usage.sourceStepId)
        else onOpenTest(usage.ownerId)
    }, [onOpenStep, onOpenTest])

    const handleAddShared = React.useCallback(async () => {
        const created = await onAddSharedStep()
        if (created) {
            setShowSharedLibrary(true)
            setSelectedSharedId(created)
            setFocusSharedStepId(null)
        }
    }, [onAddSharedStep])

    const handleCreateSharedFromStep = React.useCallback(async (step: Step, name?: string) => {
        const created = await onAddSharedStepFromStep(step, name)
        if (created) {
            setShowSharedLibrary(true)
            setSelectedSharedId(created)
            setFocusSharedStepId(step.id)
        }
    }, [onAddSharedStepFromStep])

    const handleOpenShared = React.useCallback((sharedId: string, stepId?: string) => {
        setShowSharedLibrary(true)
        setSelectedSharedId(sharedId)
        setFocusSharedStepId(stepId ?? null)
    }, [])

    React.useImperativeHandle(ref, () => ({ commit: () => {} }), [])

    return (
        <div className="test-editor">
            <div className="meta-card" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                <div className="field" style={{ margin: 0 }}>
                    <label className="label-sm">Zephyr key</label>
                    <input
                        className="input"
                        value={getLink('zephyr')}
                        onChange={(e) => upsertLink('zephyr', e.target.value)}
                        placeholder="Example: PROD-T6079 or 6079"
                    />
                </div>
                <div className="field" style={{ margin: 0 }}>
                    <label className="label-sm">Allure ID</label>
                    <input
                        className="input"
                        value={getLink('allure')}
                        onChange={(e) => upsertLink('allure', e.target.value)}
                        placeholder="Example: 12345"
                    />
                </div>
            </div>

            <div className="field">
                <label className="label-sm">Name</label>
                <input
                    value={test.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    className="input"
                    placeholder="Enter test name..."
                />
            </div>

            <SectionHeader
                title="Shared Library"
                open={showSharedLibrary}
                count={sharedSteps.length}
                onToggle={() => setShowSharedLibrary((current) => !current)}
                right={(
                    <button type="button" className="btn-small" onClick={() => void handleAddShared()}>
                        + New shared
                    </button>
                )}
            />
            {showSharedLibrary && (
                <SharedLibraryPanel
                    sharedSteps={sharedSteps}
                    selectedSharedId={selectedSharedId}
                    focusStepId={focusSharedStepId}
                    allTests={allTests}
                    resolveRefs={resolveRefs}
                    inspectRefs={inspectRefs}
                    onOpenRef={openResolvedRef}
                    onActivateEditorApi={setActiveEditorApi}
                    onSelectShared={(id) => {
                        setSelectedSharedId(id)
                        setFocusSharedStepId(null)
                    }}
                    onAddShared={handleAddShared}
                    onUpdateShared={onUpdateSharedStep}
                    onDeleteShared={(sharedId) => {
                        onDeleteSharedStep(sharedId)
                        if (selectedSharedId === sharedId) {
                            setSelectedSharedId(null)
                            setFocusSharedStepId(null)
                        }
                    }}
                    onInsertShared={onInsertSharedReference}
                    onOpenUsage={openUsage}
                    onOpenShared={handleOpenShared}
                    onInsertText={insertIntoActiveEditor}
                />
            )}

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
                onApply={() => {}}
                onActivateEditorApi={setActiveEditorApi}
                onCreateSharedFromStep={handleCreateSharedFromStep}
                onOpenShared={handleOpenShared}
                onInsertText={insertIntoActiveEditor}
            />

            <SectionHeader title="Details" open={showDetails} onToggle={() => setShowDetails((current) => !current)} />
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
                    onOpenRef={openResolvedRef}
                    onActivateEditorApi={setActiveEditorApi}
                />
            )}

            <SectionHeader
                title="Attachments"
                open={showAttachments}
                count={test.attachments?.length ?? 0}
                onToggle={() => setShowAttachments((current) => !current)}
            />
            {showAttachments && (
                <AttachmentsPanel
                    attachments={test.attachments ?? []}
                    onChange={(next) => onChange({ attachments: next })}
                />
            )}

            <SectionHeader title="Parameters" open={showMeta} onToggle={() => setShowMeta((current) => !current)} />
            {showMeta && (
                <ParamsPanel
                    meta={(test.meta as TestMeta) ?? { tags: [] }}
                    onChange={(nextMeta) => onChange({ meta: nextMeta })}
                />
            )}
        </div>
    )
})

const SectionHeader = ({
    title,
    open,
    count,
    onToggle,
    right,
}: {
    title: string
    open: boolean
    count?: number
    onToggle(): void
    right?: React.ReactNode
}) => (
    <div className="section-header" data-spoiler data-nopress>
        <button type="button" onClick={onToggle}>
            <span style={{ width: 14, textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
            <span>
                {title}
                {typeof count === 'number' ? ` (${count})` : ''}
            </span>
        </button>
        <span className="spacer" />
        {right}
    </div>
)
