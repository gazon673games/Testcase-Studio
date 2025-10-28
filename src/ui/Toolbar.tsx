import * as React from 'react'

type Props = {
    onAddFolder(): void; onAddTest(): void; onDelete(): void; onSave(): void;
    onPull(): void; onPush(): void; onSyncAll(): void;
    onOpenSettings(): void;
}
export function Toolbar(p: Props) {
    const Btn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props} style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #ccc', background:'#f7f7f7' }} />
    )
    return (
        <div style={{ display:'flex', gap:8, padding:8, borderBottom:'1px solid #eee' }}>
            <Btn onClick={p.onAddFolder}>+ Folder</Btn>
            <Btn onClick={p.onAddTest}>+ Test</Btn>
            <Btn onClick={p.onDelete}>Delete</Btn>
            <span style={{ flex:1 }} />
            <Btn onClick={p.onPull}>Pull</Btn>
            <Btn onClick={p.onPush}>Push</Btn>
            <Btn onClick={p.onSyncAll}>Sync</Btn>
            <Btn onClick={p.onSave}>Save</Btn>
            <Btn onClick={p.onOpenSettings} title="Settings">⚙️</Btn>
        </div>
    )
}
