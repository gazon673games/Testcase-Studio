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
    const [showDetails, setShowDetails] = useStoredToggle('test-editor.show-details', true)
    const [showMeta, setShowMeta] = useStoredToggle('test-editor.show-meta', false)
    const [showAttachments, setShowAttachments] = useStoredToggle('test-editor.show-attachments', false)
    const [showLinks, setShowLinks] = useStoredToggle('test-editor.show-links', false)
    const [showSharedLibrary, setShowSharedLibrary] = useStoredToggle('test-editor.show-shared-library.v2', false)
    const [selectedSharedId, setSelectedSharedId] = React.useState<string | null>(sharedSteps[0]?.id ?? null)
    const [focusSharedStepId, setFocusSharedStepId] = React.useState<string | null>(null)
    const [activeEditorApi, setActiveEditorApi] = React.useState<MarkdownEditorApi | null>(null)

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
    }, [onOpenStep, onOpenTest, setShowSharedLibrary])

    const openUsage = React.useCallback((usage: SharedUsage) => {
        if (usage.ownerType === 'shared') {
            setShowSharedLibrary(true)
            setSelectedSharedId(usage.ownerId)
            setFocusSharedStepId(usage.sourceStepId ?? null)
            return
        }
        if (usage.sourceStepId) onOpenStep(usage.ownerId, usage.sourceStepId)
        else onOpenTest(usage.ownerId)
    }, [onOpenStep, onOpenTest, setShowSharedLibrary])

    const handleAddShared = React.useCallback(async () => {
        const created = await onAddSharedStep()
        if (created) {
            setShowSharedLibrary(true)
            setSelectedSharedId(created)
            setFocusSharedStepId(null)
        }
    }, [onAddSharedStep, setShowSharedLibrary])

    const handleCreateSharedFromStep = React.useCallback(async (step: Step, name?: string) => {
        const created = await onAddSharedStepFromStep(step, name)
        if (created) {
            setShowSharedLibrary(true)
            setSelectedSharedId(created)
            setFocusSharedStepId(step.id)
        }
    }, [onAddSharedStepFromStep, setShowSharedLibrary])

    const handleOpenShared = React.useCallback((sharedId: string, stepId?: string) => {
        setShowSharedLibrary(true)
        setSelectedSharedId(sharedId)
        setFocusSharedStepId(stepId ?? null)
    }, [setShowSharedLibrary])

    const zephyrLink = getLink('zephyr')
    const allureLink = getLink('allure')
    const sharedReferenceCount = React.useMemo(
        () => (test.steps ?? []).filter((step) => step.usesShared).length,
        [test.steps]
    )
    const tagsCount = test.meta?.tags?.length ?? 0
    const externalLinksCount = (zephyrLink ? 1 : 0) + (allureLink ? 1 : 0)
    const summaryItems = [
        `${test.steps.length} step${test.steps.length === 1 ? '' : 's'}`,
        sharedReferenceCount ? `${sharedReferenceCount} shared ref${sharedReferenceCount === 1 ? '' : 's'}` : '',
        test.attachments?.length ? `${test.attachments.length} attachment${test.attachments.length === 1 ? '' : 's'}` : '',
        tagsCount ? `${tagsCount} tag${tagsCount === 1 ? '' : 's'}` : '',
        zephyrLink ? 'Linked to Zephyr' : '',
        allureLink ? 'Linked to Allure' : '',
    ].filter(Boolean)

    React.useImperativeHandle(ref, () => ({ commit: () => {} }), [])

    return (
        <div className={`test-editor-shell ${showSharedLibrary ? 'with-drawer' : ''}`}>
            <div className="test-editor-main">
                <div className="test-editor">
                    <div className="editor-hero">
                        <div className="editor-hero-bar">
                            <div className="editor-hero-title-group">
                                <div className="editor-hero-copy">Test case</div>
                                <div className="editor-summary-row editor-summary-row--compact">
                                    {summaryItems.map((item) => (
                                        <span key={item} className="editor-summary-chip">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="editor-hero-actions">
                                <button
                                    type="button"
                                    className={`btn-small editor-side-button ${showSharedLibrary ? 'active' : ''}`}
                                    onClick={() => setShowSharedLibrary((current) => !current)}
                                >
                                    {showSharedLibrary ? 'Hide Library' : `Library (${sharedSteps.length})`}
                                </button>
                            </div>
                        </div>
                        <div className="field editor-name-field">
                            <label className="label-sm">Name</label>
                            <input
                                value={test.name}
                                onChange={(e) => onChange({ name: e.target.value })}
                                className="input editor-name-input"
                                placeholder="Enter test case name..."
                            />
                        </div>
                    </div>

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

                    <SectionHeader
                        title="Details"
                        open={showDetails}
                        onToggle={() => setShowDetails((current) => !current)}
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
                            onOpenRef={openResolvedRef}
                            onActivateEditorApi={setActiveEditorApi}
                        />
                    )}

                    <SectionHeader
                        title="Parameters"
                        open={showMeta}
                        onToggle={() => setShowMeta((current) => !current)}
                    />
                    {showMeta && (
                        <ParamsPanel
                            meta={(test.meta as TestMeta) ?? { tags: [] }}
                            onChange={(nextMeta) => onChange({ meta: nextMeta })}
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

                    <SectionHeader
                        title="Integrations"
                        open={showLinks}
                        count={externalLinksCount}
                        onToggle={() => setShowLinks((current) => !current)}
                    />
                    {showLinks && (
                        <div className="meta-card editor-links-card">
                            <div className="editor-links-grid">
                                <div className="field" style={{ margin: 0 }}>
                                    <label className="label-sm">Zephyr key</label>
                                    <input
                                        className="input"
                                        value={zephyrLink}
                                        onChange={(e) => upsertLink('zephyr', e.target.value)}
                                        placeholder="Example: PROD-T6079 or 6079"
                                    />
                                </div>
                                <div className="field" style={{ margin: 0 }}>
                                    <label className="label-sm">Allure ID</label>
                                    <input
                                        className="input"
                                        value={allureLink}
                                        onChange={(e) => upsertLink('allure', e.target.value)}
                                        placeholder="Example: 12345"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showSharedLibrary && (
                <aside className="editor-drawer" aria-label="Shared library drawer">
                    <SharedLibraryPanel
                        variant="drawer"
                        extraHeaderAction={(
                            <button
                                type="button"
                                className="btn-small"
                                onClick={() => setShowSharedLibrary(false)}
                            >
                                Close
                            </button>
                        )}
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
                </aside>
            )}
        </div>
    )
})

function useStoredToggle(key: string, initialValue: boolean) {
    const [value, setValue] = React.useState(() => {
        try {
            const stored = window.localStorage.getItem(key)
            if (stored == null) return initialValue
            return stored === '1'
        } catch {
            return initialValue
        }
    })

    React.useEffect(() => {
        try {
            window.localStorage.setItem(key, value ? '1' : '0')
        } catch {
            // local persistence is best-effort only
        }
    }, [key, value])

    return [value, setValue] as const
}

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
            <span style={{ width: 14, textAlign: 'center' }}>{open ? '-' : '+'}</span>
            <span>
                {title}
                {typeof count === 'number' ? ` (${count})` : ''}
            </span>
        </button>
        <span className="spacer" />
        {right}
    </div>
)
