import * as React from 'react'
import { useUiPreferences } from '../preferences'

type Props = {
    zephyrLink: string
    allureLink: string
    onChangeZephyr(value: string): void
    onChangeAllure(value: string): void
}

export function TestEditorLinksCard({
    zephyrLink,
    allureLink,
    onChangeZephyr,
    onChangeAllure,
}: Props) {
    const { t } = useUiPreferences()

    return (
        <div className="meta-card editor-links-card">
            <div className="editor-links-grid">
                <div className="field field--flush">
                    <label className="label-sm">{t('editor.zephyrKey')}</label>
                    <input
                        className="input"
                        value={zephyrLink}
                        onChange={(event) => onChangeZephyr(event.target.value)}
                        placeholder={t('editor.zephyrKeyPlaceholder')}
                    />
                </div>
                <div className="field field--flush">
                    <label className="label-sm">{t('editor.allureId')}</label>
                    <input
                        className="input"
                        value={allureLink}
                        onChange={(event) => onChangeAllure(event.target.value)}
                        placeholder={t('editor.allureIdPlaceholder')}
                    />
                </div>
            </div>
        </div>
    )
}
