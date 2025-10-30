import * as React from 'react'
import type { TestCase, TestMeta } from '@core/domain'
import { MarkdownEditor } from '../markdownEditor/MarkdownEditor'
import './DetailsPanel.css'

type Props = {
    /** Описание теста (теперь тоже Markdown, как и остальные поля) */
    description: string
    onChangeDescription(v: string): void

    meta: TestMeta
    onChangeMeta(m: TestMeta): void

    /** для [[wiki-refs]] и автокомплита */
    allTests: TestCase[]
    /** резолвер [[...]] */
    resolveRefs(src: string): string
}

export function DetailsPanel({
                                 description,
                                 onChangeDescription,
                                 meta,
                                 onChangeMeta,
                                 allTests,
                                 resolveRefs,
                             }: Props) {
    const [preview, setPreview] = React.useState<{
        description: boolean
        objective: boolean
        preconditions: boolean
    }>({
        description: false,
        objective: false,
        preconditions: false,
    })

    const setObjective = (v: string) => onChangeMeta({ ...(meta ?? { tags: [] }), objective: v })
    const setPreconditions = (v: string) =>
        onChangeMeta({ ...(meta ?? { tags: [] }), preconditions: v })

    return (
        <div className="details-panel card-box">
            {/* Description — теперь MarkdownEditor с таким же UX, как у остальных */}
            <div className="field">
                <div className="details-head">
                    <label className="label-sm">Description</label>
                    <div className="md-view">
                        <span className="muted">View:</span>{' '}
                        <button
                            className="btn-icon"
                            onClick={() => setPreview((p) => ({ ...p, description: !p.description }))}
                            title="Toggle preview"
                        >
                            {preview.description ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>
                <MarkdownEditor
                    value={description}
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
                            onClick={() => setPreview((p) => ({ ...p, objective: !p.objective }))}
                            title="Toggle preview"
                        >
                            {preview.objective ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>
                <MarkdownEditor
                    value={meta?.objective ?? ''}
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
                            onClick={() => setPreview((p) => ({ ...p, preconditions: !p.preconditions }))}
                            title="Toggle preview"
                        >
                            {preview.preconditions ? 'Raw' : 'Preview'}
                        </button>
                    </div>
                </div>
                <MarkdownEditor
                    value={meta?.preconditions ?? ''}
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
