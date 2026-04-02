import * as React from 'react'
import type { ZephyrImportMode } from '@app/sync'
import {
    PreviewAlert,
    PreviewButton,
    PreviewCard,
    PreviewField,
    PreviewHint,
} from '../previewDialog'
import { useUiPreferences } from '../preferences'

type Props = {
    mode: ZephyrImportMode
    projectKey: string
    folder: string
    refsText: string
    rawQuery: string
    maxResults: string
    mirrorRemoteFolders: boolean
    loading: boolean
    applying: boolean
    error: string | null
    canPreview: boolean
    projectInputRef: React.RefObject<HTMLInputElement | null>
    folderInputRef: React.RefObject<HTMLInputElement | null>
    refsInputRef: React.RefObject<HTMLTextAreaElement | null>
    onClose(): void
    onSubmit(event?: React.FormEvent): void | Promise<void>
    setMode(value: ZephyrImportMode): void
    setProjectKey(value: string): void
    setFolder(value: string): void
    setRefsText(value: string): void
    setRawQuery(value: string): void
    setMaxResults(value: string): void
    setMirrorRemoteFolders(value: boolean): void
}

export function ZephyrImportScopeForm({
    mode,
    projectKey,
    folder,
    refsText,
    rawQuery,
    maxResults,
    mirrorRemoteFolders,
    loading,
    applying,
    error,
    canPreview,
    projectInputRef,
    folderInputRef,
    refsInputRef,
    onClose,
    onSubmit,
    setMode,
    setProjectKey,
    setFolder,
    setRefsText,
    setRawQuery,
    setMaxResults,
    setMirrorRemoteFolders,
}: Props) {
    const { t } = useUiPreferences()

    return (
        <form className="preview-dialog__column" onSubmit={onSubmit}>
            <PreviewCard title={t('import.scope')}>
                <div className="preview-dialog__tab-row">
                    {(['project', 'folder', 'keys'] as ZephyrImportMode[]).map((value) => (
                        <button
                            key={value}
                            type="button"
                            className={`preview-dialog__tab-button${value === mode ? ' preview-dialog__tab-button--active' : ''}`}
                            onClick={() => setMode(value)}
                        >
                            {t(`import.mode.${value}`)}
                        </button>
                    ))}
                </div>

                {mode !== 'keys' && (
                    <PreviewField label={t('import.projectKey')}>
                        <input
                            ref={projectInputRef}
                            className="preview-dialog__input"
                            value={projectKey}
                            onChange={(event) => setProjectKey(event.target.value)}
                            placeholder="PROD"
                        />
                    </PreviewField>
                )}

                {mode === 'folder' && (
                    <PreviewField label={t('import.folderPath')}>
                        <input
                            ref={folderInputRef}
                            className="preview-dialog__input"
                            value={folder}
                            onChange={(event) => setFolder(event.target.value)}
                            placeholder="/CORE/Regression/Auth"
                        />
                    </PreviewField>
                )}

                {mode === 'keys' && (
                    <PreviewField label={t('import.keysOrIds')}>
                        <textarea
                            ref={refsInputRef}
                            className="preview-dialog__textarea"
                            value={refsText}
                            onChange={(event) => setRefsText(event.target.value)}
                            placeholder={'PROD-T6079\nPROD-T6209\n6078'}
                            rows={6}
                        />
                    </PreviewField>
                )}

                <PreviewField label={t('import.rawQuery')}>
                    <textarea
                        className="preview-dialog__textarea"
                        value={rawQuery}
                        onChange={(event) => setRawQuery(event.target.value)}
                        placeholder={t('import.rawQueryPlaceholder')}
                        rows={4}
                    />
                </PreviewField>

                <div className="preview-dialog__inline-row">
                    <div className="preview-dialog__field-inline-grow">
                        <PreviewField label={t('import.maxResults')}>
                            <input
                                className="preview-dialog__input"
                                value={maxResults}
                                onChange={(event) => setMaxResults(event.target.value)}
                                inputMode="numeric"
                                placeholder="100"
                            />
                        </PreviewField>
                    </div>
                    <label className="preview-dialog__checkbox-label">
                        <input
                            type="checkbox"
                            checked={mirrorRemoteFolders}
                            onChange={(event) => setMirrorRemoteFolders(event.target.checked)}
                        />
                        {t('import.mirrorFolders')}
                    </label>
                </div>

                <PreviewHint>{t('import.scopeHint')}</PreviewHint>
            </PreviewCard>

            {error ? <PreviewAlert tone="error">{error}</PreviewAlert> : null}

            <div className="preview-dialog__button-row">
                <PreviewButton type="submit" tone="primary" disabled={!canPreview}>
                    {loading ? t('import.loadingPreview') : t('import.loadPreview')}
                </PreviewButton>
                <PreviewButton type="button" tone="ghost" onClick={onClose} disabled={loading || applying}>
                    {t('import.close')}
                </PreviewButton>
            </div>
        </form>
    )
}
