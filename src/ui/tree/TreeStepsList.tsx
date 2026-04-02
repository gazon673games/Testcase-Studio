import * as React from 'react'
import type { Step } from '@core/domain'
import type { TreeKeyboardHandler, TreeTranslate } from './types'
import { makeStepKey } from './utils'

type TreeStepsListProps = {
    testId: string
    parentKey: string
    steps: Step[]
    depth: number
    focusedKey: string
    onFocusItem(key: string): void
    onTreeKeyDown: TreeKeyboardHandler
    registerRowRef(key: string, element: HTMLElement | null): void
    onOpenStep: (testId: string, stepId: string) => void
    t: TreeTranslate
    stepLabelByKey: Map<string, string>
}

export function TreeStepsList({
    testId,
    parentKey,
    steps,
    depth,
    focusedKey,
    onFocusItem,
    onTreeKeyDown,
    registerRowRef,
    onOpenStep,
    t,
    stepLabelByKey,
}: TreeStepsListProps) {
    const offset = 24 + depth * 14

    return (
        <div role="group" className="tree-step-list" style={{ ['--tree-step-offset' as string]: `${offset}px` }}>
            {steps.map((step, index) => {
                const details = [
                    step.usesShared ? t('tree.sharedRef') : '',
                    step.subSteps?.length ? t('tree.subCount', { count: step.subSteps.length }) : '',
                    step.attachments?.length ? t('tree.fileCount', { count: step.attachments.length }) : '',
                ].filter(Boolean)
                const key = makeStepKey(testId, step.id)
                const label = stepLabelByKey.get(key) ?? t('tree.untitledStep')
                const item = {
                    key,
                    kind: 'step' as const,
                    id: step.id,
                    testId,
                    parentKey,
                    depth,
                    hasChildren: false as const,
                    expanded: false as const,
                    name: label,
                }
                const focused = key === focusedKey

                return (
                    <div
                        key={step.id}
                        ref={(element) => registerRowRef(key, element)}
                        role="treeitem"
                        aria-level={depth + 1}
                        tabIndex={focused ? 0 : -1}
                        className={`tree-step-row${focused ? ' is-focused' : ''}`}
                        title={t('tree.openStepTitle')}
                        onFocus={() => onFocusItem(key)}
                        onKeyDown={(event) => onTreeKeyDown(event, item)}
                        onClick={(event) => {
                            event.stopPropagation()
                            onFocusItem(key)
                            onOpenStep(testId, step.id)
                        }}
                    >
                        <span className="tree-step-index">{index + 1}</span>
                        <div className="tree-step-content">
                            <div className="tree-step-label">{label}</div>
                            {details.length ? <div className="tree-step-meta">{details.join(' / ')}</div> : null}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
