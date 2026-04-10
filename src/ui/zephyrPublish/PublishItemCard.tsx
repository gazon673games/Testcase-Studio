import * as React from 'react'
import type { ZephyrPublishPreviewItem } from '@app/sync'
import { PreviewAlert, PreviewBadge, PreviewCard, PreviewDiffCard, PreviewHint } from '../previewDialog'
import { useUiPreferences } from '../preferences'

type Props = {
    item: ZephyrPublishPreviewItem
    publish: boolean
    onToggle(value: boolean): void
    containerRef?: (node: HTMLDivElement | null) => void
}

export function PublishItemCard({ item, publish, onToggle, containerRef }: Props) {
    const { t } = useUiPreferences()
    const tone =
        item.status === 'create'
            ? 'ok'
            : item.status === 'update'
                ? 'info'
                : item.status === 'blocked'
                    ? 'warn'
                    : 'muted'

    return (
        <div ref={containerRef} tabIndex={-1}>
            <PreviewCard>
                <div className="preview-dialog__summary-row">
                    <div className="preview-dialog__summary-copy">
                        <div className="preview-dialog__card-title">{item.testName}</div>
                        <div className="preview-dialog__subtitle">
                            <span>{item.externalId ?? t('publish.newCase')}</span>
                            {item.projectKey ? ` / ${item.projectKey}` : ''}
                            {item.folder ? ` / ${item.folder}` : ''}
                        </div>
                    </div>
                    <PreviewBadge tone={tone}>{t(`publish.status.${item.status}`)}</PreviewBadge>
                </div>

                <PreviewHint>{item.reason}</PreviewHint>

                <label className="preview-dialog__checkbox-label">
                    <input
                        type="checkbox"
                        checked={publish}
                        disabled={item.status === 'blocked' || item.status === 'skip'}
                        onChange={(event) => onToggle(event.target.checked)}
                    />
                    {t('publish.include')}
                </label>

                {item.attachmentWarnings.length > 0 ? (
                    <PreviewAlert tone="warning">
                        {item.attachmentWarnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                        ))}
                    </PreviewAlert>
                ) : null}

                {item.diffs.length > 0 ? (
                    <div className="preview-dialog__list">
                        {item.diffs.map((diff) => (
                            <PreviewDiffCard
                                key={`${item.id}:${diff.field}`}
                                title={diff.label}
                                leftLabel={t('preview.remote')}
                                rightLabel={t('preview.localPublish')}
                                leftText={diff.remote}
                                rightText={diff.local}
                                stepRows={diff.stepRows}
                                leftSide="remote"
                                rightSide="local"
                            />
                        ))}
                    </div>
                ) : null}
            </PreviewCard>
        </div>
    )
}
