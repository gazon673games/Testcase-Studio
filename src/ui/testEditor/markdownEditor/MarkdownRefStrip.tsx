import * as React from 'react'
import { formatResolvedRefBrokenReason, formatResolvedRefLabel, type ResolvedWikiRef } from '@core/refs'
import { trimText } from './autocomplete'

type Translate = (key: string, params?: Record<string, string | number>) => string

type MarkdownRefStripProps = {
    refs: ResolvedWikiRef[]
    t: Translate
    onOpenRef?: (ref: ResolvedWikiRef) => void
}

export function MarkdownRefStrip({ refs, t, onOpenRef }: MarkdownRefStripProps) {
    const [hoveredRef, setHoveredRef] = React.useState<ResolvedWikiRef | null>(null)

    if (refs.length === 0) return null

    return (
        <div className="md-ref-strip">
            {refs.map((refInfo, index) => (
                <button
                    key={`${refInfo.raw}-${index}`}
                    type="button"
                    className={`md-ref-pill ${refInfo.ok ? 'ok' : 'broken'}`}
                    onMouseEnter={() => setHoveredRef(refInfo)}
                    onMouseLeave={() => setHoveredRef((current) => (current?.raw === refInfo.raw ? null : current))}
                    onClick={() => {
                        if (refInfo.ok) onOpenRef?.(refInfo)
                    }}
                    title={refInfo.ok ? refInfo.preview : formatResolvedRefBrokenReason(refInfo, t)}
                >
                    {refInfo.ok
                        ? trimText(formatResolvedRefLabel(refInfo, t), 44)
                        : `${t('markdown.brokenPrefix')}: ${trimText(refInfo.body, 32)}`}
                </button>
            ))}
            {hoveredRef && (
                <div className={`md-ref-preview ${hoveredRef.ok ? 'ok' : 'broken'}`}>
                    <div className="md-ref-preview-title">
                        {hoveredRef.ok ? formatResolvedRefLabel(hoveredRef, t) : t('steps.brokenLink')}
                    </div>
                    <div className="md-ref-preview-body">
                        {hoveredRef.ok ? hoveredRef.preview : formatResolvedRefBrokenReason(hoveredRef, t)}
                    </div>
                    {hoveredRef.ok && onOpenRef && (
                        <button
                            type="button"
                            className="md-ref-open"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onOpenRef(hoveredRef)}
                        >
                            {t('markdown.openSource')}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
