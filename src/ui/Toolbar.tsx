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
    const publishMeta =
        props.publishCount === 0
            ? 'Publish -> empty scope'
            : props.publishCount === 1
                ? `Publish -> ${props.publishSelectionLabel}`
                : `Publish -> ${props.publishCount} tests`

    return (
        <div style={toolbarStyle}>
            <div style={workspaceStyle}>
                <div style={workspaceEyebrowStyle}>Workspace</div>
                <div style={workspaceTitleStyle} title={props.selectionLabel}>
                    {props.selectionLabel}
                </div>
                <div style={workspaceMetaStyle}>
                    <span title={props.importDestinationLabel}>{`Import -> ${props.importDestinationLabel}`}</span>
                    <span>{publishMeta}</span>
                </div>
            </div>

            <div style={actionsStyle}>
                <ToolbarCluster label="Local">
                    <ToolbarButton onClick={props.onSave} tone="primary" title="Save (Ctrl+S)">
                        Save
                    </ToolbarButton>
                    <ToolbarButton onClick={props.onAddTest}>New Test</ToolbarButton>
                    <ToolbarButton onClick={props.onAddFolder} tone="quiet">
                        Folder
                    </ToolbarButton>
                </ToolbarCluster>

                <ToolbarCluster label="Sync">
                    <ToolbarButton onClick={props.onImport} tone="info" title="Import from Zephyr into local">
                        Import...
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={props.onPublish}
                        tone="danger"
                        title={`Preview and publish local changes to Zephyr for ${props.publishSelectionLabel}`}
                        disabled={!props.canPublish}
                    >
                        Publish...
                    </ToolbarButton>
                </ToolbarCluster>

                <ToolbarOverflowMenu
                    onPull={props.onPull}
                    onSyncAll={props.onSyncAll}
                    onExport={props.onExport}
                    onDelete={props.onDelete}
                    onOpenSettings={props.onOpenSettings}
                    canPull={props.canPull}
                    canSyncAll={props.canSyncAll}
                    canExport={props.canExport}
                    canDelete={props.canDelete}
                />
            </div>
        </div>
    )
}

function ToolbarCluster({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div style={clusterStyle}>
            <div style={clusterLabelStyle}>{label}</div>
            <div style={clusterButtonsStyle}>{children}</div>
        </div>
    )
}

function ToolbarOverflowMenu({
    onPull,
    onSyncAll,
    onExport,
    onDelete,
    onOpenSettings,
    canPull,
    canSyncAll,
    canExport,
    canDelete,
}: {
    onPull(): void
    onSyncAll(): void
    onExport(): void
    onDelete(): void
    onOpenSettings(): void
    canPull?: boolean
    canSyncAll?: boolean
    canExport?: boolean
    canDelete?: boolean
}) {
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        if (!open) return

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null
            if (target && containerRef.current?.contains(target)) return
            setOpen(false)
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }

        document.addEventListener('mousedown', onPointerDown)
        window.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    const closeAndRun = (action: () => void) => {
        setOpen(false)
        action()
    }

    return (
        <div ref={containerRef} style={overflowWrapStyle}>
            <ToolbarButton
                tone="quiet"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-haspopup="menu"
                title="More actions"
            >
                More
            </ToolbarButton>

            {open ? (
                <div role="menu" aria-label="More actions" style={overflowMenuStyle}>
                    <OverflowItem
                        label="Pull latest"
                        hint="Refresh the current linked test from Zephyr"
                        disabled={!canPull}
                        onClick={() => closeAndRun(onPull)}
                    />
                    <OverflowItem
                        label="Quick sync"
                        hint="Run the fast sync flow without preview"
                        disabled={!canSyncAll}
                        onClick={() => closeAndRun(onSyncAll)}
                    />
                    <OverflowItem
                        label="Export JSON"
                        hint="Download the current test as JSON"
                        disabled={!canExport}
                        onClick={() => closeAndRun(onExport)}
                    />
                    <OverflowItem
                        label="Delete selection"
                        hint="Remove the current test or folder"
                        disabled={!canDelete}
                        tone="danger"
                        onClick={() => closeAndRun(onDelete)}
                    />
                    <OverflowItem
                        label="Settings"
                        hint="Open integrations and app settings"
                        onClick={() => closeAndRun(onOpenSettings)}
                    />
                </div>
            ) : null}
        </div>
    )
}

function OverflowItem({
    label,
    hint,
    tone = 'neutral',
    disabled,
    onClick,
}: {
    label: string
    hint: string
    tone?: 'neutral' | 'danger'
    disabled?: boolean
    onClick(): void
}) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={onClick}
            style={{
                ...overflowItemStyle,
                ...(tone === 'danger' ? overflowDangerItemStyle : null),
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            <span style={overflowItemLabelStyle}>{label}</span>
            <span style={overflowItemHintStyle}>{hint}</span>
        </button>
    )
}

function ToolbarButton({
    tone = 'neutral',
    ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'neutral' | 'primary' | 'info' | 'danger' | 'quiet'
}) {
    return (
        <button
            type={buttonProps.type ?? 'button'}
            {...buttonProps}
            style={{
                padding: '7px 12px',
                borderRadius: 10,
                border: toneStyles[tone].border,
                background: toneStyles[tone].background,
                color: toneStyles[tone].color,
                cursor: buttonProps.disabled ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: toneStyles[tone].fontWeight,
                opacity: buttonProps.disabled ? 0.45 : 1,
                whiteSpace: 'nowrap',
            }}
        />
    )
}

const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px',
    borderBottom: '1px solid #edf1f6',
    background: '#ffffff',
    flexWrap: 'wrap',
}

const workspaceStyle: React.CSSProperties = {
    minWidth: 0,
    flex: '1 1 340px',
    display: 'grid',
    gap: 3,
}

const workspaceEyebrowStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: '#6e7d93',
}

const workspaceTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#253950',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const workspaceMetaStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    fontSize: 12,
    color: '#6b7a90',
}

const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginLeft: 'auto',
}

const clusterStyle: React.CSSProperties = {
    display: 'grid',
    gap: 5,
    padding: '7px 9px',
    border: '1px solid #e9edf3',
    borderRadius: 12,
    background: '#fbfcff',
}

const clusterLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: '#627086',
}

const clusterButtonsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
}

const overflowWrapStyle: React.CSSProperties = {
    position: 'relative',
}

const overflowMenuStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    minWidth: 230,
    display: 'grid',
    gap: 4,
    padding: 8,
    border: '1px solid #e5eaf1',
    borderRadius: 14,
    background: '#ffffff',
    boxShadow: '0 18px 46px rgba(18, 36, 58, 0.12)',
    zIndex: 20,
}

const overflowItemStyle: React.CSSProperties = {
    border: 'none',
    background: '#fff',
    borderRadius: 10,
    padding: '9px 10px',
    display: 'grid',
    gap: 2,
    textAlign: 'left',
}

const overflowDangerItemStyle: React.CSSProperties = {
    background: '#fff7f6',
}

const overflowItemLabelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: '#24384f',
}

const overflowItemHintStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.4,
    color: '#6a7890',
}

const toneStyles: Record<
    'neutral' | 'primary' | 'info' | 'danger' | 'quiet',
    { border: string; background: string; color: string; fontWeight: number }
> = {
    neutral: {
        border: '1px solid #d5dce6',
        background: '#f8fafc',
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
    danger: {
        border: '1px solid #e4b0a5',
        background: '#fff0ec',
        color: '#9d3422',
        fontWeight: 700,
    },
    quiet: {
        border: '1px solid #e1e7ef',
        background: '#ffffff',
        color: '#5d6f87',
        fontWeight: 600,
    },
}
