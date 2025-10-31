import * as React from 'react'
import type { TestCase, TestMeta } from '@core/domain'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import './DetailsPanel.css'

type Props = {
    /** Markdown-описание теста */
    description: string
    onChangeDescription(v: string): void

    /** Метаданные теста (objective / preconditions и т.п.) */
    meta: TestMeta | undefined
    onChangeMeta(next: TestMeta): void

    /** для [[wiki-refs]] и автокомплита */
    allTests: TestCase[]
    /** резолвер [[...]] */
    resolveRefs(src: string): string
}

/** Безопасно мерджим мету, чтобы не терять tags/params и прочие поля */
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
                                 resolveRefs,
                             }: Props) {
    const [preview, setPreview] = React.useState({
        description: false,
        objective: false,
        preconditions: false,
    })

    // ⚙️ сеттеры полей meta.* (строки; в UI всегда держим строку, даже если в источнике было null)
    const setObjective = React.useCallback(
        (v: string) => onChangeMeta(mergeMeta(meta, { objective: v })),
        [meta, onChangeMeta],
    )
    const setPreconditions = React.useCallback(
        (v: string) => onChangeMeta(mergeMeta(meta, { preconditions: v })),
        [meta, onChangeMeta],
    )

    return (
        <div className="details-panel card-box">
            {/* Description — MarkdownEditor с превью как у остальных полей */}
            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Description</label>
                    <div className="md-view">
                        <span className="muted">View:</span>{' '}
                        <button
                            className="btn-icon"
                            onClick={() => setPreview(p => ({ ...p, description: !p.description }))}
                            title="Toggle preview"
                            type="button"
                        >
                            {preview.description ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>

                <MarkdownEditor
                    value={description ?? ''}           // ← UI всегда получает строку
                    onChange={onChangeDescription}
                    rows={4}
                    preview={preview.description}
                    resolveRefs={resolveRefs}
                    allTests={allTests as any}
                />
            </div>

            {/* Test Objective */}
            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Test Objective</label>
                    <div className="md-view">
                        <span className="muted">View:</span>{' '}
                        <button
                            className="btn-icon"
                            onClick={() => setPreview(p => ({ ...p, objective: !p.objective }))}
                            title="Toggle preview"
                            type="button"
                        >
                            {preview.objective ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>

                <MarkdownEditor
                    value={meta?.objective ?? ''}       // ← null/undefined → ''
                    onChange={setObjective}
                    rows={4}
                    preview={preview.objective}
                    resolveRefs={resolveRefs}
                    allTests={allTests as any}
                />
            </div>

            {/* Preconditions */}
            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Preconditions</label>
                    <div className="md-view">
                        <span className="muted">View:</span>{' '}
                        <button
                            className="btn-icon"
                            onClick={() => setPreview(p => ({ ...p, preconditions: !p.preconditions }))}
                            title="Toggle preview"
                            type="button"
                        >
                            {preview.preconditions ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>

                <MarkdownEditor
                    value={meta?.preconditions ?? ''}   // ← null/undefined → ''
                    onChange={setPreconditions}
                    rows={4}
                    preview={preview.preconditions}
                    resolveRefs={resolveRefs}
                    allTests={allTests as any}
                />
            </div>
        </div>
    )
}

export default DetailsPanel
