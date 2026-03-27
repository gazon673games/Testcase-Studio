import * as React from 'react'

type Props = {
    selectionLabel: string
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
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
    canDelete?: boolean
    canPull?: boolean
    canPublish?: boolean
    canSyncAll?: boolean
    canExport?: boolean
}

export function Toolbar(props: Props) {
    const Btn = ({
        tone = 'neutral',
        ...buttonProps
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        tone?: 'neutral' | 'primary' | 'info' | 'warning' | 'danger' | 'quiet'
    }) => (
        <button
            type={buttonProps.type ?? 'button'}
            {...buttonProps}
            style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: toneStyles[tone].border,
                background: toneStyles[tone].background,
                color: toneStyles[tone].color,
                cursor: buttonProps.disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: toneStyles[tone].fontWeight,
                transition: 'transform .06s ease, filter .06s ease',
                opacity: buttonProps.disabled ? 0.45 : 1,
            }}
        />
    )

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderBottom: '1px solid #eee',
                background: '#f7f8fb',
                flexWrap: 'wrap',
            }}
        >
            <ToolbarGroup
                label="Workspace"
                description={`Selected: ${props.selectionLabel}`}
            >
                <Btn onClick={props.onAddFolder}>New Folder</Btn>
                <Btn onClick={props.onAddTest}>New Test</Btn>
                <Btn onClick={props.onDelete} disabled={!props.canDelete}>
                    Delete
                </Btn>
            </ToolbarGroup>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <ToolbarGroup
                    label="Zephyr"
                    description={`Import -> ${props.importDestinationLabel}`}
                >
                    <Btn onClick={props.onImport} title="Import from Zephyr into local" tone="info">
                        Import...
                    </Btn>
                    <Btn onClick={props.onPull} title="Pull latest provider state into current test" disabled={!props.canPull}>
                        Pull
                    </Btn>
                    <Btn
                        onClick={props.onSyncAll}
                        title="Quick two-way sync without preview"
                        tone="warning"
                        disabled={!props.canSyncAll}
                    >
                        Quick Sync
                    </Btn>
                </ToolbarGroup>

                <ToolbarGroup
                    label="Publish"
                    description={`${props.publishSelectionLabel} / ${props.publishCount} tests`}
                >
                    <Btn
                        onClick={props.onPublish}
                        title="Preview and publish local changes to Zephyr"
                        tone="danger"
                        disabled={!props.canPublish}
                    >
                        Publish...
                    </Btn>
                </ToolbarGroup>

                <ToolbarGroup label="File" description="Local actions">
                    <Btn onClick={props.onExport} title="Export current test to JSON" disabled={!props.canExport}>
                        Export
                    </Btn>
                    <Btn onClick={props.onSave} title="Save (Ctrl+S)" tone="primary">
                        Save
                    </Btn>
                    <Btn onClick={props.onOpenSettings} title="Settings" tone="quiet" data-nopress>
                        Settings
                    </Btn>
                </ToolbarGroup>
            </div>
        </div>
    )
}

function ToolbarGroup({
    label,
    description,
    children,
}: {
    label: string
    description: string
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                display: 'grid',
                gap: 6,
                padding: '8px 10px',
                border: '1px solid #e4e8ef',
                borderRadius: 12,
                background: '#fff',
            }}
        >
            <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#627086' }}>
                    {label}
                </div>
                <div style={{ fontSize: 12, color: '#6f7d92', lineHeight: 1.35 }}>{description}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
        </div>
    )
}

const toneStyles: Record<
    'neutral' | 'primary' | 'info' | 'warning' | 'danger' | 'quiet',
    { border: string; background: string; color: string; fontWeight: number }
> = {
    neutral: {
        border: '1px solid #d0d6df',
        background: '#f8f9fb',
        color: '#24384f',
        fontWeight: 500,
    },
    primary: {
        border: '1px solid #9fc0f3',
        background: '#e6f0ff',
        color: '#174e9b',
        fontWeight: 700,
    },
    info: {
        border: '1px solid #bfd4f6',
        background: '#edf4ff',
        color: '#225ca8',
        fontWeight: 600,
    },
    warning: {
        border: '1px solid #ebd5a8',
        background: '#fff7e5',
        color: '#8a5a00',
        fontWeight: 600,
    },
    danger: {
        border: '1px solid #e4b0a5',
        background: '#fff0ec',
        color: '#9d3422',
        fontWeight: 700,
    },
    quiet: {
        border: '1px solid transparent',
        background: 'transparent',
        color: '#5d6f87',
        fontWeight: 500,
    },
}
