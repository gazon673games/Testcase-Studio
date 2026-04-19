import * as React from 'react'
import type { ZephyrPublishPreview } from '@app/sync'
import {
    PreviewAlert,
    PreviewButton,
    PreviewCard,
    PreviewHint,
} from '../previewDialog'

type Translate = (key: string, params?: Record<string, string | number>) => string

type Props = {
    loading: boolean
    applying: boolean
    error: string | null
    preview: ZephyrPublishPreview | null
    confirmText: string
    confirmReady: boolean
    requiresConfirmation: boolean
    canApply: boolean
    disabledReason: string | null
    loadButtonRef: React.RefObject<HTMLButtonElement | null>
    onConfirmTextChange(text: string): void
    onPreview(): void
    onApply(): void
    onClose(): void
    t: Translate
}

export function ZephyrPublishSidebar({
    loading,
    applying,
    error,
    preview,
    confirmText,
    confirmReady,
    requiresConfirmation,
    canApply,
    disabledReason,
    loadButtonRef,
    onConfirmTextChange,
    onPreview,
    onApply,
    onClose,
    t,
}: Props) {
    return (
        <div className="preview-dialog__column">
            <PreviewCard title={t('publish.dryRun')}>
                <PreviewHint>{t('publish.dryRunHint')}</PreviewHint>
            </PreviewCard>

            <PreviewCard title={t('publish.confirmation')}>
                <PreviewHint>
                    {requiresConfirmation ? t('publish.confirmationHint') : t('publish.confirmationReady')}
                </PreviewHint>
                <input
                    className="preview-dialog__input"
                    value={confirmText}
                    onChange={(event) => onConfirmTextChange(event.target.value)}
                    placeholder="PUBLISH"
                    disabled={!requiresConfirmation}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && canApply) {
                            event.preventDefault()
                            onApply()
                        }
                    }}
                />
                {preview ? (
                    <PreviewHint>
                        {requiresConfirmation
                            ? (confirmReady ? t('publish.confirmationReady') : disabledReason ?? t('publish.confirmationMissing'))
                            : t('publish.confirmationReady')}
                    </PreviewHint>
                ) : null}
            </PreviewCard>

            {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

            <div className="preview-dialog__button-row">
                <PreviewButton
                    ref={loadButtonRef}
                    tone="soft"
                    onClick={onPreview}
                    disabled={loading || applying}
                >
                    {loading
                        ? t('publish.loadingPreview')
                        : preview
                            ? t('publish.refreshPreview')
                            : t('publish.preparePreview')}
                </PreviewButton>
                <PreviewButton tone="danger" disabled={!canApply} onClick={onApply}>
                    {applying ? t('publish.running') : t('publish.run')}
                </PreviewButton>
                <PreviewButton tone="ghost" onClick={onClose} disabled={loading || applying}>
                    {t('publish.close')}
                </PreviewButton>
            </div>
            {disabledReason ? <PreviewHint>{disabledReason}</PreviewHint> : null}
        </div>
    )
}
