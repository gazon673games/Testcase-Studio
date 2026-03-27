import * as React from 'react'
import type { SharedStep, TestCase, TestMeta } from '@core/domain'
import type { ResolvedWikiRef } from '@core/refs'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import './DetailsPanel.css'

type Props = {
    description: string
    onChangeDescription(v: string): void
    meta: TestMeta | undefined
    onChangeMeta(next: TestMeta): void
    allTests: TestCase[]
    sharedSteps: SharedStep[]
    resolveRefs(src: string): string
    inspectRefs(src: string): ResolvedWikiRef[]
    onOpenRef(ref: ResolvedWikiRef): void
    onActivateEditorApi?: (api: MarkdownEditorApi | null) => void
    previewMode?: 'raw' | 'preview'
}

function mergeMeta(prev: TestMeta | undefined, patch: Partial<TestMeta>): TestMeta {
    return {
        tags: prev?.tags ?? [],
        params: prev?.params,
        ...prev,
        ...patch,
    }
}

export function DetailsPanel({
    description,
    onChangeDescription,
    meta,
    onChangeMeta,
    allTests,
    sharedSteps,
    resolveRefs,
    inspectRefs,
    onOpenRef,
    onActivateEditorApi,
    previewMode,
}: Props) {
    const [preview, setPreview] = React.useState({
        description: false,
        objective: false,
        preconditions: false,
    })

    const setObjective = React.useCallback(
        (value: string) => onChangeMeta(mergeMeta(meta, { objective: value })),
        [meta, onChangeMeta]
    )
    const setPreconditions = React.useCallback(
        (value: string) => onChangeMeta(mergeMeta(meta, { preconditions: value })),
        [meta, onChangeMeta]
    )

    const editorProps = {
        resolveRefs,
        inspectRefs,
        onOpenRef,
        allTests,
        sharedSteps,
        onActivateApi: onActivateEditorApi,
    }

    const isControlledPreview = previewMode != null
    const resolvePreview = (key: keyof typeof preview) => (isControlledPreview ? previewMode === 'preview' : preview[key])

    return (
        <div className="details-panel card-box">
            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Description</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">View:</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, description: !current.description }))}
                                title="Toggle preview"
                                type="button"
                            >
                                {preview.description ? 'Raw' : 'Preview'}
                            </button>
                        </div>
                    )}
                </div>

                <MarkdownEditor
                    value={description ?? ''}
                    onChange={onChangeDescription}
                    rows={4}
                    preview={resolvePreview('description')}
                    {...editorProps}
                />
            </div>

            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Test Objective</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">View:</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, objective: !current.objective }))}
                                title="Toggle preview"
                                type="button"
                            >
                                {preview.objective ? 'Raw' : 'Preview'}
                            </button>
                        </div>
                    )}
                </div>

                <MarkdownEditor
                    value={meta?.objective ?? ''}
                    onChange={setObjective}
                    rows={4}
                    preview={resolvePreview('objective')}
                    {...editorProps}
                />
            </div>

            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Preconditions</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">View:</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, preconditions: !current.preconditions }))}
                                title="Toggle preview"
                                type="button"
                            >
                                {preview.preconditions ? 'Raw' : 'Preview'}
                            </button>
                        </div>
                    )}
                </div>

                <MarkdownEditor
                    value={meta?.preconditions ?? ''}
                    onChange={setPreconditions}
                    rows={4}
                    preview={resolvePreview('preconditions')}
                    {...editorProps}
                />
            </div>
        </div>
    )
}

export default DetailsPanel
