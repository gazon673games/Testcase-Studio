import * as React from 'react'
import type { Attachment } from '@core/domain'
import './AttachmentsPanel.css' // общий стиль

type Props = {
    stepId: string
    attachments: Attachment[]
    onChange(next: Attachment[]): void
    /** Кастомный аплоадер (опц.). Если не передан — читаем как data:URL локально. */
    onUploadStepFiles?: (stepId: string, files: File[]) => Promise<Attachment[]>
    accept?: string
    compact?: boolean
}

export default function StepAttachmentsPanel({
                                                 stepId,
                                                 attachments,
                                                 onChange,
                                                 onUploadStepFiles,
                                                 accept = '*/*',
                                                 compact = true,
                                             }: Props) {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const [loading, setLoading] = React.useState(false)

    async function fallbackReadAsDataUrl(files: File[]): Promise<Attachment[]> {
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
            const created = onUploadStepFiles
                ? await onUploadStepFiles(stepId, files)
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
        <div className={`attachments-panel ${compact ? '' : 'meta-card'}`} style={{ marginTop: 8 }}>
            <div className="attachments-head" style={{ marginBottom: 4 }}>
                <label className="label-sm">Step attachments</label>
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
                <div className="muted">No files.</div>
            ) : (
                <ul className="attachments-list">
                    {attachments.map(a => (
                        <li key={a.id} className="attachment-item">
                            <a
                                className="file-name"
                                href={a.pathOrDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={a.name}
                                title={a.name}
                            >
                                {a.name}
                            </a>
                            <button
                                type="button"
                                className="btn-small remove-btn"
                                title="Remove file"
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
