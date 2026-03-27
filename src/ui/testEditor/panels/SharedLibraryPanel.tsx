import * as React from 'react'
import { collectSharedUsages, type ResolvedWikiRef, type SharedUsage } from '@core/refs'
import type { SharedStep, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import StepsPanel from './StepsPanel'

type Props = {
    sharedSteps: SharedStep[]
    selectedSharedId: string | null
    focusStepId?: string | null
    allTests: TestCase[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onSelectShared(id: string): void
    onAddShared(): void | Promise<void>
    onUpdateShared(sharedId: string, patch: Partial<Pick<SharedStep, 'name' | 'steps'>>): void | Promise<void>
    onDeleteShared(sharedId: string): void | Promise<void>
    onInsertShared(sharedId: string): void | Promise<void>
    onOpenUsage(usage: SharedUsage): void
    onOpenShared(sharedId: string, stepId?: string): void
    onInsertText?: (text: string) => void | Promise<void>
}

export default function SharedLibraryPanel({
    sharedSteps,
    selectedSharedId,
    focusStepId,
    allTests,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateEditorApi,
    onSelectShared,
    onAddShared,
    onUpdateShared,
    onDeleteShared,
    onInsertShared,
    onOpenUsage,
    onOpenShared,
    onInsertText,
}: Props) {
    const selected = sharedSteps.find((item) => item.id === selectedSharedId) ?? sharedSteps[0] ?? null
    const usages = React.useMemo(
        () => (selected ? collectSharedUsages(selected, allTests, sharedSteps) : []),
        [allTests, selected, sharedSteps]
    )

    React.useEffect(() => {
        if (!selected && sharedSteps[0]) onSelectShared(sharedSteps[0].id)
    }, [onSelectShared, selected, sharedSteps])

    return (
        <div className="shared-library">
            <div className="shared-library-sidebar">
                <div className="shared-library-head">
                    <div className="shared-library-title">Reusable steps</div>
                    <button type="button" className="btn-small" onClick={() => void onAddShared()}>
                        + New shared
                    </button>
                </div>

                {sharedSteps.length === 0 ? (
                    <div className="shared-library-empty">The library is empty. Create the first shared step and reuse it across tests.</div>
                ) : (
                    <div className="shared-library-list">
                        {sharedSteps.map((shared) => {
                            const usageCount = collectSharedUsages(shared, allTests, sharedSteps).length
                            return (
                                <button
                                    key={shared.id}
                                    type="button"
                                    className={`shared-library-item ${selected?.id === shared.id ? 'active' : ''}`}
                                    onClick={() => onSelectShared(shared.id)}
                                >
                                    <div className="shared-library-item-title">{shared.name}</div>
                                    <div className="shared-library-item-meta">
                                        <span>{shared.steps.length} steps</span>
                                        <span>{usageCount} usages</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="shared-library-main">
                {!selected ? (
                    <div className="shared-library-empty main">Select a shared step to edit it.</div>
                ) : (
                    <>
                        <div className="shared-library-toolbar">
                            <div className="field" style={{ margin: 0, flex: 1 }}>
                                <label className="label-sm">Shared step name</label>
                                <input
                                    className="input"
                                    value={selected.name}
                                    onChange={(e) => onUpdateShared(selected.id, { name: e.target.value })}
                                    placeholder="Shared step name"
                                />
                            </div>
                            <div className="shared-library-actions">
                                <button type="button" className="btn-small" onClick={() => onInsertShared(selected.id)}>
                                    Insert into test
                                </button>
                                <button type="button" className="btn-small" onClick={() => onDeleteShared(selected.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div className="shared-library-usage-card">
                            <div className="shared-library-usage-title">Usages and backlinks</div>
                            {usages.length === 0 ? (
                                <div className="shared-library-usage-empty">This shared step is not used anywhere yet.</div>
                            ) : (
                                <div className="shared-library-usage-list">
                                    {usages.map((usage) => (
                                        <button
                                            key={usage.id}
                                            type="button"
                                            className="shared-library-usage-item"
                                            onClick={() => onOpenUsage(usage)}
                                        >
                                            <span className="shared-library-usage-kind">{usage.kind === 'usesShared' ? 'Uses shared' : 'Ref'}</span>
                                            <span className="shared-library-usage-name">{usage.ownerName}</span>
                                            <span className="shared-library-usage-source">{usage.sourceLabel}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <StepsPanel
                            owner={{ type: 'shared', id: selected.id }}
                            steps={selected.steps}
                            onChange={(next) => onUpdateShared(selected.id, { steps: next })}
                            allTests={allTests}
                            sharedSteps={sharedSteps}
                            resolveRefs={resolveRefs}
                            inspectRefs={inspectRefs}
                            onOpenRef={onOpenRef}
                            focusStepId={focusStepId}
                            onActivateEditorApi={onActivateEditorApi}
                            onOpenShared={onOpenShared}
                            onInsertText={onInsertText}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
