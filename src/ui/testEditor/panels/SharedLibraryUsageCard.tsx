import * as React from 'react'
import type { SharedUsage } from '@core/refs'
import { useUiPreferences } from '../../preferences'

type Props = {
    usages: SharedUsage[]
    onOpenUsage(usage: SharedUsage): void
}

export function SharedLibraryUsageCard({ usages, onOpenUsage }: Props) {
    const { t } = useUiPreferences()

    return (
        <div className="shared-library-usage-card">
            <div className="shared-library-usage-title">{t('shared.usageTitle')}</div>
            {usages.length === 0 ? (
                <div className="shared-library-usage-empty">{t('shared.usageEmpty')}</div>
            ) : (
                <div className="shared-library-usage-list">
                    {usages.map((usage) => (
                        <button
                            key={usage.id}
                            type="button"
                            className="shared-library-usage-item"
                            onClick={() => onOpenUsage(usage)}
                        >
                            <span className="shared-library-usage-kind">
                                {usage.kind === 'usesShared' ? t('shared.usageKindShared') : t('shared.usageKindRef')}
                            </span>
                            <span className="shared-library-usage-name">{usage.ownerName}</span>
                            <span className="shared-library-usage-source">{usage.sourceLabel}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
