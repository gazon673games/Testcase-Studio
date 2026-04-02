import type { ZephyrImportPreviewItem, ZephyrImportStrategy } from '@app/sync'
import {
    PreviewBadge,
    PreviewCard,
    PreviewDiffCard,
    PreviewField,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'

type Props = {
    item: ZephyrImportPreviewItem
    strategy: ZephyrImportStrategy
    onChangeStrategy(value: ZephyrImportStrategy): void
    containerRef?: (node: HTMLDivElement | null) => void
}

export function ZephyrImportPreviewItemCard({ item, strategy, onChangeStrategy, containerRef }: Props) {
    const { t } = useUiPreferences()

    const statusTone =
        item.status === 'new'
            ? 'ok'
            : item.status === 'update'
                ? 'info'
                : item.status === 'conflict'
                    ? 'warn'
                    : 'muted'

    const options: Array<{ value: ZephyrImportStrategy; label: string }> = [
        ...(!item.replaceDisabled ? [{ value: 'replace' as const, label: t('import.strategy.replace') }] : []),
        { value: 'skip' as const, label: t('import.strategy.skip') },
        { value: 'merge-locally-later' as const, label: t('import.strategy.mergeLater') },
    ]

    return (
        <div ref={containerRef} tabIndex={-1}>
            <PreviewCard>
                <div className="preview-dialog__summary-row">
                    <div className="preview-dialog__summary-copy">
                        <div className="preview-dialog__card-title">{item.remoteName}</div>
                        <div className="preview-dialog__subtitle">
                            <span>{item.remoteId}</span>
                            {item.remoteFolder ? ` / ${item.remoteFolder}` : ''}
                        </div>
                    </div>
                    <PreviewBadge tone={statusTone}>{t(`import.status.${item.status}`)}</PreviewBadge>
                </div>

                <PreviewHint>{item.reason}</PreviewHint>

                <PreviewInfoGrid>
                    <PreviewInfoPair label={t('import.localTest')} value={item.localName ?? t('import.willBeCreated')} />
                    <PreviewInfoPair label={t('import.localFolder')} value={item.localFolder ?? '-'} />
                    <PreviewInfoPair label={t('import.importInto')} value={item.targetFolderLabel} />
                    <PreviewInfoPair label={t('import.matches')} value={String(item.localMatchIds.length || 0)} />
                </PreviewInfoGrid>

                {item.diffs.length > 0 ? (
                    <div className="preview-dialog__list">
                        {item.diffs.map((diff) => (
                            <PreviewDiffCard
                                key={`${item.id}:${diff.field}`}
                                title={diff.label}
                                leftLabel={t('import.localTest')}
                                rightLabel={t('preview.remote')}
                                leftText={diff.local}
                                rightText={diff.remote}
                                stepRows={diff.stepRows}
                                leftSide="local"
                                rightSide="remote"
                            />
                        ))}
                    </div>
                ) : null}

                <PreviewField label={t('import.conflictStrategy')}>
                    <select
                        className="preview-dialog__select"
                        value={strategy}
                        onChange={(event) => onChangeStrategy(event.target.value as ZephyrImportStrategy)}
                        disabled={item.status === 'unchanged'}
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </PreviewField>
            </PreviewCard>
        </div>
    )
}
