import * as React from 'react'
import type { Attachment } from '@core/domain'
import './AttachmentsPanel.css'
import { useUiPreferences } from '../../preferences'

type Props = {
    attachments: Attachment[]
    onChange(next: Attachment[]): void
    onUploadFiles?: (files: File[]) => Promise<Attachment[]>
    accept?: string
}

export function AttachmentsPanel({ attachments, onChange, onUploadFiles, accept = '*/*' }: Props) {
    const { t } = useUiPreferences()
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const [loading, setLoading] = React.useState(false)

    async function fallbackReadAsDataUrl(files: File[]): Promise<Attachment[]> {
        const toDataUrl = (file: File) =>
            new Promise<Attachment>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () =>
                    resolve({
                        id: crypto.randomUUID(),
                        name: file.name,
                        pathOrDataUrl: reader.result as string,
                    })
                reader.onerror = reject
                reader.readAsDataURL(file)
            })
        return Promise.all(files.map(toDataUrl))
    }

    async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? [])
        if (!files.length) return
        setLoading(true)
        try {
            const created = onUploadFiles ? await onUploadFiles(files) : await fallbackReadAsDataUrl(files)
            onChange([...(attachments ?? []), ...created])
        } finally {
            setLoading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    function remove(id: string) {
        onChange((attachments ?? []).filter((attachment) => attachment.id !== id))
    }

    return (
        <div className="attachments-panel meta-card">
            <div className="attachments-head">
                <label className="label-sm">{t('attachments.title')}</label>
                <div className="attachments-actions">
                    <button type="button" className="btn-small" onClick={() => inputRef.current?.click()} disabled={loading}>
                        {loading ? t('attachments.uploading') : t('attachments.upload')}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={accept}
                        className="attachments-input-hidden"
                        onChange={onFilePicked}
                    />
                </div>
            </div>

            {(attachments ?? []).length === 0 ? (
                <div className="muted">{t('attachments.none')}</div>
            ) : (
                <ul className="attachments-list">
                    {attachments.map((attachment) => (
                        <li key={attachment.id} className="attachment-item">
                            <a
                                className="file-name"
                                href={attachment.pathOrDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={attachment.name}
                                download={attachment.name}
                            >
                                {attachment.name}
                            </a>
                            <button
                                type="button"
                                className="btn-small remove-btn"
                                title={t('attachments.remove')}
                                onClick={() => remove(attachment.id)}
                                disabled={loading}
                            >
                                x
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default AttachmentsPanel
