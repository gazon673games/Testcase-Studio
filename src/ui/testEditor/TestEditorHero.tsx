import * as React from 'react'
import { useUiPreferences } from '../preferences'

type Props = {
    testName: string
    summaryItems: string[]
    showSharedLibrary: boolean
    sharedStepsCount: number
    parseZephyrHtmlParts: boolean
    onToggleSharedLibrary(): void
    onToggleParseZephyrHtmlParts(value: boolean): void
    onChangeName(value: string): void
}

export function TestEditorHero({
    testName,
    summaryItems,
    showSharedLibrary,
    sharedStepsCount,
    parseZephyrHtmlParts,
    onToggleSharedLibrary,
    onToggleParseZephyrHtmlParts,
    onChangeName,
}: Props) {
    const { t } = useUiPreferences()

    return (
        <div className="editor-hero">
            <div className="editor-hero-bar">
                <div className="editor-hero-title-group">
                    <div className="editor-hero-copy">{t('editor.testCase')}</div>
                    <div className="editor-summary-row editor-summary-row--compact">
                        {summaryItems.map((item) => (
                            <span key={item} className="editor-summary-chip">
                                {item}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="editor-hero-actions">
                    <label className="editor-hero-toggle">
                        <input
                            type="checkbox"
                            checked={parseZephyrHtmlParts}
                            onChange={(event) => onToggleParseZephyrHtmlParts(event.target.checked)}
                        />
                        <span>{t('editor.parseZephyrHtmlParts')}</span>
                    </label>
                    <button
                        type="button"
                        className={`btn-small editor-side-button ${showSharedLibrary ? 'active' : ''}`}
                        onClick={onToggleSharedLibrary}
                    >
                        {showSharedLibrary ? t('editor.hideLibrary') : t('editor.libraryCount', { count: sharedStepsCount })}
                    </button>
                </div>
            </div>
            <div className="field editor-name-field">
                <label className="label-sm">{t('editor.name')}</label>
                <input
                    value={testName}
                    onChange={(event) => onChangeName(event.target.value)}
                    className="input editor-name-input"
                    placeholder={t('editor.namePlaceholder')}
                />
            </div>
        </div>
    )
}
