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
                padding: '6px 11px',
                borderRadius: 9,
                border: toneStyles[tone].border,
                background: toneStyles[tone].background,
                color: toneStyles[tone].color,
                cursor: buttonProps.disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: toneStyles[tone].fontWeight,
                opacity: buttonProps.disabled ? 0.45 : 1,
            }}
        />
    )

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderBottom: '1px solid #edf1f6',
                background: '#ffffff',
                flexWrap: 'wrap',
            }}
        >
            <div
                style={{
                    minWidth: 0,
                    maxWidth: 320,
                    display: 'grid',
                    gap: 2,
                    paddingRight: 6,
                }}
            >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#6e7d93' }}>
                    Workspace
                </div>
                <div
                    style={{
                        fontSize: 13,
                        color: '#2a4059',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                    title={props.selectionLabel}
                >
                    {props.selectionLabel}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <ToolbarGroup label="Local">
                    <Btn onClick={props.onAddFolder}>New Folder</Btn>
                    <Btn onClick={props.onAddTest}>New Test</Btn>
                    <Btn onClick={props.onDelete} disabled={!props.canDelete}>
                        Delete
                    </Btn>
                </ToolbarGroup>

                <ToolbarGroup label="Zephyr" meta={`Import -> ${props.importDestinationLabel}`}>
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
                    meta={props.publishCount > 0 ? `${props.publishCount} in scope` : 'Nothing in scope'}
                >
                    <Btn
                        onClick={props.onPublish}
                        title={`Preview and publish local changes to Zephyr for ${props.publishSelectionLabel}`}
                        tone="danger"
                        disabled={!props.canPublish}
                    >
                        Publish...
                    </Btn>
                </ToolbarGroup>

                <ToolbarGroup label="File">
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
    meta,
    children,
}: {
    label: string
    meta?: string
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                display: 'grid',
                gap: 5,
                padding: '7px 9px',
                border: '1px solid #e7ebf2',
                borderRadius: 12,
                background: '#fbfcff',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#627086' }}>
                    {label}
                </div>
                {meta ? (
                    <div
                        style={{
                            fontSize: 11,
                            color: '#6f7d92',
                            background: '#f1f5fb',
                            borderRadius: 999,
                            padding: '2px 7px',
                        }}
                    >
                        {meta}
                    </div>
                ) : null}
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
