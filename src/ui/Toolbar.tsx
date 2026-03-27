import * as React from 'react'

type Props = {
    onAddFolder(): void
    onAddTest(): void
    onDelete(): void
    onSave(): void
    onImport(): void
    onPull(): void
    onPublish(): void
    onSyncAll(): void
    onExport(): void
    onOpenSettings(): void
}

export function Toolbar(props: Props) {
    const Btn = (buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button
            type={buttonProps.type ?? 'button'}
            {...buttonProps}
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
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderBottom: '1px solid #eee',
                background: '#fafafa',
            }}
        >
            <Btn onClick={props.onAddFolder}>New Folder</Btn>
            <Btn onClick={props.onAddTest}>New Test</Btn>
            <Btn onClick={props.onDelete}>Delete</Btn>

            <span style={{ flex: 1 }} />

            <Btn onClick={props.onImport} title="Import from Zephyr into local">
                Import
            </Btn>
            <Btn onClick={props.onPull} title="Pull from provider">
                Pull
            </Btn>
            <Btn onClick={props.onPublish} title="Publish local changes to Zephyr">
                Publish
            </Btn>
            <Btn onClick={props.onSyncAll} title="Two-way sync with provider">
                Sync
            </Btn>
            <Btn onClick={props.onExport} title="Export current test or tree">
                Export
            </Btn>

            <Btn
                onClick={props.onSave}
                title="Save (Ctrl+S)"
                style={{
                    padding: '6px 14px',
                    fontWeight: 600,
                    background: '#e8f3ff',
                    border: '1px solid #bcd7ff',
                }}
            >
                Save
            </Btn>

            <Btn
                onClick={props.onOpenSettings}
                title="Settings"
                style={{ border: 'none', background: 'transparent', fontSize: 16 }}
                data-nopress
            >
                Settings
            </Btn>
        </div>
    )
}
