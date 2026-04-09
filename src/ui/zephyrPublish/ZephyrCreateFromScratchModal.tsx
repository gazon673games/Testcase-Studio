import * as React from 'react'
import type { ZephyrPublishPreview } from '@app/sync'
import {
    PreviewAlert,
    PreviewBadge,
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'
import { buildCreateFromScratchChecks, canCreateFromScratch, getCreateFromScratchItem } from './createFromScratch'
import './ZephyrCreateFromScratchModal.css'

type Props = {
    open: boolean
    preview: ZephyrPublishPreview | null
    onClose(): void
    onCreate(preview: ZephyrPublishPreview): Promise<unknown>
}

export function ZephyrCreateFromScratchModal({ open, preview, onClose, onCreate }: Props) {
    const { t } = useUiPreferences()
    const [creating, setCreating] = React.useState(false)

    React.useEffect(() => {
        if (!open) setCreating(false)
    }, [open])

    const item = getCreateFromScratchItem(preview)
    const checks = React.useMemo(
        () => (item ? buildCreateFromScratchChecks(item, t) : []),
        [item, t]
    )
    const ready = item ? canCreateFromScratch(item, t) : false

    if (!open || !preview || !item) return null

    const folder = String(item.folder ?? item.payload.extras?.folder ?? '').trim() || t('publish.createSummary.none')
    const projectKey = String(item.projectKey ?? item.payload.extras?.projectKey ?? '').trim() || t('publish.createSummary.none')
    const attachmentCount = (item.payload.attachments ?? []).length
    const stepCount = (item.payload.steps ?? []).length

    const activePreview = preview

    async function handleCreate() {
        if (!ready || creating) return
        setCreating(true)
        try {
            await onCreate(activePreview)
            onClose()
        } finally {
            setCreating(false)
        }
    }

    return (
        <PreviewDialog
            open={open}
            title={t('publish.createFromScratchTitle')}
            subtitle={t('publish.createFromScratchSubtitle')}
            onClose={onClose}
            canDismiss={!creating}
        >
            <div className="zephyr-create-modal">
                <PreviewCard>
                    <div className="zephyr-create-modal__header">
                        <div className="zephyr-create-modal__title">{item.testName}</div>
                        <PreviewBadge tone={ready ? 'ok' : 'warn'}>
                            {ready ? t('publish.createReady') : t('publish.createBlocked')}
                        </PreviewBadge>
                    </div>
                    <PreviewHint>{t('publish.createMissingId')}</PreviewHint>
                    <PreviewInfoGrid>
                        <PreviewInfoPair label={t('publish.createSummary.projectKey')} value={projectKey} />
                        <PreviewInfoPair label={t('publish.createSummary.folder')} value={folder} />
                        <PreviewInfoPair label={t('publish.createSummary.steps')} value={String(stepCount)} />
                        <PreviewInfoPair label={t('publish.createSummary.attachments')} value={String(attachmentCount)} />
                    </PreviewInfoGrid>
                </PreviewCard>

                <PreviewCard title={t('publish.createChecklist')}>
                    <div className="zephyr-create-modal__checks">
                        {checks.map((check) => (
                            <div key={check.id} className="zephyr-create-modal__check">
                                <div className="zephyr-create-modal__check-main">
                                    <div className="zephyr-create-modal__check-label">{check.label}</div>
                                    <div className="zephyr-create-modal__check-detail">{check.detail}</div>
                                </div>
                                <PreviewBadge tone={check.passed ? 'ok' : 'warn'}>
                                    {check.passed ? t('publish.createCheck.ready') : t('publish.createCheck.missing')}
                                </PreviewBadge>
                            </div>
                        ))}
                    </div>
                </PreviewCard>

                {!ready ? (
                    <PreviewAlert tone="warning">{item.reason}</PreviewAlert>
                ) : null}

                <div className="zephyr-create-modal__actions">
                    <PreviewButton tone="ghost" onClick={onClose} disabled={creating}>
                        {t('publish.createLater')}
                    </PreviewButton>
                    <PreviewButton onClick={handleCreate} disabled={!ready || creating}>
                        {creating ? t('publish.createRunning') : t('publish.createAction')}
                    </PreviewButton>
                </div>
            </div>
        </PreviewDialog>
    )
}
