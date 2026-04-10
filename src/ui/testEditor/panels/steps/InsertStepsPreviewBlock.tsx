import * as React from 'react'
import { renderInsertStepsPreviewHtml } from './insertStepsPreviewHtml'

type Props = {
    label: string
    value: string
    emptyLabel: string
    resolveRefs(src: string): string
}

export function InsertStepsPreviewBlock({ label, value, emptyLabel, resolveRefs }: Props) {
    const html = React.useMemo(() => renderInsertStepsPreviewHtml(value, resolveRefs), [resolveRefs, value])
    const isEmpty = !String(value ?? '').trim()

    return (
        <div className="insert-steps-modal__field">
            <div className="insert-steps-modal__field-label">{label}</div>
            {isEmpty ? (
                <div className="insert-steps-modal__field-empty">{emptyLabel}</div>
            ) : (
                <div
                    className="insert-steps-modal__field-preview"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    )
}
