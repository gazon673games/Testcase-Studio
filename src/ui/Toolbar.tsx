import * as React from 'react'

type Props = {
    onAddFolder(): void; onAddTest(): void; onDelete(): void; onSave(): void;
    onPull(): void; onPush(): void; onSyncAll(): void;
    onExport(): void;                     // ⬅️ новое
    onOpenSettings(): void;
}

export function Toolbar(p: Props) {
    const Btn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button
            {...props}
            style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #d0d0d0',
                background: '#f9f9f9',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'transform .06s ease, filter .06s ease',
            }}
        />
    )

    return (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:8, borderBottom:'1px solid #eee', background:'#fafafa' }}>
            <Btn onClick={p.onAddFolder}>📁 New Folder</Btn>
            <Btn onClick={p.onAddTest}>🧩 New Test</Btn>
            <Btn onClick={p.onDelete}>🗑️ Delete</Btn>

            <span style={{ flex:1 }} />

            <Btn onClick={p.onPull} title="Pull from provider">⬇️ Pull</Btn>
            <Btn onClick={p.onPush} title="Push to provider">⬆️ Push</Btn>
            <Btn onClick={p.onSyncAll} title="Two-way sync with provider">🔁 Sync</Btn>

            {/* Новый экспорт */}
            <Btn onClick={p.onExport} title="Export current test or tree">📤 Export</Btn>

            <Btn
                onClick={p.onSave}
                title="Save (Ctrl+S)"
                style={{ padding:'6px 14px', fontWeight:600, background:'#e8f3ff', border:'1px solid #bcd7ff' }}
            >
                💾 Save
            </Btn>

            <Btn onClick={p.onOpenSettings} title="Settings" style={{ border:'none', background:'transparent', fontSize:16 }} data-nopress>
                ⚙️
            </Btn>
        </div>
    )
}
