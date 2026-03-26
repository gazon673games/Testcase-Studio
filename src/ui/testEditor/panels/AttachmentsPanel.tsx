import * as React from 'react'
import type { Attachment } from '@core/domain'
import './AttachmentsPanel.css'

type Props = {
    attachments: Attachment[]
    onChange(next: Attachment[]): void
    /** Кастомный аплоадер: сохраняет файлы и возвращает готовые Attachment (c id, name, pathOrDataUrl). Необязателен. */
    onUploadFiles?: (files: File[]) => Promise<Attachment[]>
    /** Ограничение типов (опционально) */
    accept?: string
}

export function AttachmentsPanel({ attachments, onChange, onUploadFiles, accept = '*/*' }: Props) {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const [loading, setLoading] = React.useState(false)

    async function fallbackReadAsDataUrl(files: File[]): Promise<Attachment[]> {
        // Локальный фоллбек: читаем файлы в data URL и возвращаем Attachment[]
        const toDataUrl = (f: File) =>
            new Promise<Attachment>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve({
                    id: crypto.randomUUID(),
                    name: f.name,
                    pathOrDataUrl: reader.result as string,
                })
                reader.onerror = reject
                reader.readAsDataURL(f)
            })
        return Promise.all(files.map(toDataUrl))
    }

    async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return
        setLoading(true)
        try {
            const created = onUploadFiles
                ? await onUploadFiles(files)
                : await fallbackReadAsDataUrl(files)
            onChange([...(attachments ?? []), ...created])
        } finally {
            setLoading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    function remove(id: string) {
        onChange((attachments ?? []).filter(a => a.id !== id))
    }

    return (
        <div className="attachments-panel meta-card">
            <div className="attachments-head">
                <label className="label-sm">Attachments</label>
                <div className="attachments-actions">
                    <button type="button" className="btn-small" onClick={() => inputRef.current?.click()} disabled={loading}>
                        {loading ? 'Uploading…' : '+ Upload'}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={accept}
                        style={{ display: 'none' }}
                        onChange={onFilePicked}
                    />
                </div>
            </div>

            {(attachments ?? []).length === 0 ? (
                <div className="muted">No attachments yet.</div>
            ) : (
                <ul className="attachments-list">
                    {attachments.map(a => (
                        <li key={a.id} className="attachment-item">
                            <a
                                className="file-name"
                                href={a.pathOrDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={a.name}
                                download={a.name}
                            >
                                {a.name}
                            </a>
                            <button
                                type="button"
                                className="btn-small remove-btn"
                                title="Remove attachment"
                                onClick={() => remove(a.id)}
                                disabled={loading}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default AttachmentsPanel
