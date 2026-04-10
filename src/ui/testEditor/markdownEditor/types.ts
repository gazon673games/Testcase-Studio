import type * as React from 'react'
import type { ResolvedWikiRef } from '@core/refs'

export type RefPart = { id?: string; text?: string }

export type RefStep = {
    id?: string
    action?: string
    data?: string
    expected?: string
    text?: string
    presentation?: {
        parts?: {
            action?: RefPart[]
            data?: RefPart[]
            expected?: RefPart[]
        }
    }
}

export type RefTest = {
    id: string
    name: string
    steps: RefStep[]
}

export type RefShared = {
    id: string
    name: string
    steps: RefStep[]
}

export type MarkdownEditorApi = {
    wrap(before: string, after: string): void
    insertPrefix(prefix: string): void
    insertText(text: string): void
    focus(): void
}

export type MarkdownEditorProps = {
    value: string
    onChange(v: string): void
    placeholder?: string
    rows?: number
    preview?: boolean
    editInPreview?: boolean
    onTogglePreview?: () => void
    resolveRefs?: (src: string) => string
    inspectRefs?: (src: string) => ResolvedWikiRef[]
    onOpenRef?: (ref: ResolvedWikiRef) => void
    allTests?: RefTest[]
    sharedSteps?: RefShared[]
    apiRef?: React.MutableRefObject<MarkdownEditorApi | null>
    onActivateApi?: (api: MarkdownEditorApi | null) => void
    hideToolbar?: boolean
    className?: string
}
