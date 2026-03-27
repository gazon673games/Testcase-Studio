import * as React from 'react'
import type { SharedStep, TestCase, TestMeta } from '@core/domain'
import type { ResolvedWikiRef } from '@core/refs'
import type { MarkdownEditorApi } from '../markdownEditor/MarkdownEditor'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import './DetailsPanel.css'
import { useUiPreferences } from '../../preferences'

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
    const { t } = useUiPreferences()
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
                    <label className="label-sm">{t('details.description')}</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">{t('details.view')}</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, description: !current.description }))}
                                title={t('details.togglePreview')}
                                type="button"
                            >
                                {preview.description ? t('details.raw') : t('details.preview')}
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
                    <label className="label-sm">{t('details.objective')}</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">{t('details.view')}</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, objective: !current.objective }))}
                                title={t('details.togglePreview')}
                                type="button"
                            >
                                {preview.objective ? t('details.raw') : t('details.preview')}
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
                    <label className="label-sm">{t('details.preconditions')}</label>
                    {!isControlledPreview && (
                        <div className="md-view">
                            <span className="muted">{t('details.view')}</span>{' '}
                            <button
                                className="btn-icon"
                                onClick={() => setPreview((current) => ({ ...current, preconditions: !current.preconditions }))}
                                title={t('details.togglePreview')}
                                type="button"
                            >
                                {preview.preconditions ? t('details.raw') : t('details.preview')}
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
