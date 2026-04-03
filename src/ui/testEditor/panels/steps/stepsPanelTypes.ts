import type * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'
import type { Attachment, PartItem, SharedStep, Step, TestCase } from '@core/domain'
import type { MarkdownEditorApi } from '../../markdownEditor/MarkdownEditor'

export type OwnerContext = { type: 'test' | 'shared'; id: string }

export type StepFieldKind = 'action' | 'data' | 'expected'

export type StepsPanelProps = {
    owner: OwnerContext
    steps: Step[]
    onChange(next: Step[]): void
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    focusStepId?: string | null
    previewMode?: 'raw' | 'preview'
    onApply?: () => void
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onCreateSharedFromStep?: (step: Step, name?: string) => void | Promise<void>
    onOpenShared?: (sharedId: string, stepId?: string) => void
    onInsertText?: (text: string) => void | Promise<void>
}

export type StepRowProps = {
    owner: OwnerContext
    index: number
    step: Step
    preview: boolean
    isNarrow: boolean
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    sharedById: Map<string, SharedStep>
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    onClone(): void
    onAddNext(): void
    onRemove(): void
    onBeautifyJson?(): void
    canBeautifyJson?: boolean
    onEditTop(patch: Partial<Step>): void
    onAddPart(idx: number, kind: StepFieldKind): void
    onEditPart(idx: number, kind: StepFieldKind, partIndex: number, patch: Partial<PartItem>): void
    onRemovePart(idx: number, kind: StepFieldKind, partIndex: number): void
    onHandleDragStart(event: React.DragEvent): void
    onHandleDragEnd(): void
    onCardDragOver(event: React.DragEvent): void
    onCardDragEnter(): void
    onCardDragLeave(): void
    onCardDrop(): void
    isDragging: boolean
    isDropTarget: boolean
    getStepAttachments(): Attachment[]
    setStepAttachments(next: Attachment[]): void
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
    onCreateSharedFromStep?: (step: Step, name?: string) => void | Promise<void>
    onOpenShared?: (sharedId: string, stepId?: string) => void
    onInsertText?: (text: string) => void | Promise<void>
}

export type OverflowAction = {
    label: string
    onClick(): void
    danger?: boolean
}
