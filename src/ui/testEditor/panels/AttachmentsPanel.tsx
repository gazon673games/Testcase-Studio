import * as React from 'react'
import type { Attachment } from '@core/domain'
import './AttachmentsPanel.css'

type Props = {
    attachments: Attachment[]
    onChange(next: Attachment[]): void
}

export function AttachmentsPanel({ attachments, onChange }: Props) {
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    function addMock() {
        const name = prompt('Attachment name (mock):', 'example.txt')
        if (!name) return
        const next: Attachment[] = [
            ...attachments,
            {
                id: crypto.randomUUID(),
                name,
                pathOrDataUrl: `mock://${name}`,
            },
        ]
        onChange(next)
    }

    function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || !files.length) return
        const next = [...attachments]
        for (const f of Array.from(files)) {
            // читаем как data URL
            const reader = new FileReader()
            reader.onload = () => {
                next.push({
                    id: crypto.randomUUID(),
                    name: f.name,
                    pathOrDataUrl: reader.result as string,
                })
                onChange([...next])
            }
            reader.readAsDataURL(f)
        }
    }

    function remove(id: string) {
        onChange(attachments.filter(a => a.id !== id))
    }

    return (
        <div className="attachments-panel meta-card">
            <div className="attachments-head">
                <label className="label-sm">Attachments</label>
                <div className="attachments-actions">
                    <button className="btn-small" onClick={addMock}>+ Mock</button>
                    <button className="btn-small" onClick={() => inputRef.current?.click()}>
                        + Upload
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={onFilePicked}
                    />
                </div>
            </div>

            {attachments.length === 0 ? (
                <div className="muted">No attachments yet.</div>
            ) : (
                <ul className="attachments-list">
                    {attachments.map(a => (
                        <li key={a.id} className="attachment-item">
                            <span className="file-name" title={a.name}>{a.name}</span>
                            <button
                                className="btn-small remove-btn"
                                title="Remove attachment"
                                onClick={() => remove(a.id)}
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
