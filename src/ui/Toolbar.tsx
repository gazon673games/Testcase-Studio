import * as React from 'react'
import { useUiPreferences } from './preferences'

type Props = {
    selectionLabel: string
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    onAddFolder(): void
    onAddTest(): void
    onDelete(): void
    onSave(): void
    onExport(): void
    onOpenSettings(): void
    onToggleSyncCenter(): void
    onTogglePreviewMode?(): void
    syncCenterOpen: boolean
    canDelete?: boolean
    canExport?: boolean
    canTogglePreview?: boolean
    previewMode?: 'raw' | 'preview'
}

export function Toolbar(props: Props) {
    const { t } = useUiPreferences()
    const publishMeta =
        props.publishCount === 0
            ? t('toolbar.publishScopeEmpty')
            : props.publishCount === 1
                ? t('toolbar.publishScopeLabel', { label: props.publishSelectionLabel })
                : t('toolbar.publishScopeCount', { count: props.publishCount })

    return (
        <div style={toolbarStyle}>
            <div style={workspaceStyle}>
                <div style={workspaceEyebrowStyle}>{t('toolbar.editor')}</div>
                <div style={workspaceTitleStyle} title={props.selectionLabel}>
                    {props.selectionLabel}
                </div>
                <div style={workspaceMetaStyle}>
                    <span title={props.importDestinationLabel}>{t('toolbar.importTarget', { label: props.importDestinationLabel })}</span>
                    <span>{publishMeta}</span>
                </div>
            </div>

            <div style={actionsStyle}>
                <ToolbarCluster label={t('toolbar.local')}>
                    <ToolbarButton onClick={props.onSave} tone="primary" title={t('toolbar.saveTitle')}>
                        {t('toolbar.save')}
                    </ToolbarButton>
                    {props.canTogglePreview ? (
                        <ToolbarButton
                            onClick={props.onTogglePreviewMode}
                            tone={props.previewMode === 'preview' ? 'info' : 'quiet'}
                            title={t('toolbar.previewTitle')}
                        >
                            {props.previewMode === 'preview' ? t('toolbar.raw') : t('toolbar.preview')}
                        </ToolbarButton>
                    ) : null}
                    <ToolbarButton onClick={props.onAddTest}>{t('toolbar.newCase')}</ToolbarButton>
                    <ToolbarButton onClick={props.onAddFolder} tone="quiet">
                        {t('toolbar.newFolder')}
                    </ToolbarButton>
                </ToolbarCluster>

                <ToolbarCluster label={t('toolbar.panels')}>
                    <ToolbarButton
                        onClick={props.onToggleSyncCenter}
                        tone={props.syncCenterOpen ? 'info' : 'quiet'}
                        title={t('toolbar.syncCenterTitle')}
                    >
                        {props.syncCenterOpen ? t('toolbar.hideSync') : t('toolbar.syncCenter')}
                    </ToolbarButton>
                </ToolbarCluster>

                <ToolbarOverflowMenu
                    onExport={props.onExport}
                    onDelete={props.onDelete}
                    onOpenSettings={props.onOpenSettings}
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
    onExport,
    onDelete,
    onOpenSettings,
    canExport,
    canDelete,
}: {
    onExport(): void
    onDelete(): void
    onOpenSettings(): void
    canExport?: boolean
    canDelete?: boolean
}) {
    const { t } = useUiPreferences()
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
                title={t('toolbar.moreTitle')}
            >
                {t('toolbar.more')}
            </ToolbarButton>

            {open ? (
                <div role="menu" aria-label={t('toolbar.moreMenu')} style={overflowMenuStyle}>
                    <OverflowItem
                        label={t('toolbar.exportJson')}
                        hint={t('toolbar.exportJsonHint')}
                        disabled={!canExport}
                        onClick={() => closeAndRun(onExport)}
                    />
                    <OverflowItem
                        label={t('toolbar.deleteSelection')}
                        hint={t('toolbar.deleteSelectionHint')}
                        disabled={!canDelete}
                        tone="danger"
                        onClick={() => closeAndRun(onDelete)}
                    />
                    <OverflowItem
                        label={t('toolbar.settings')}
                        hint={t('toolbar.settingsHint')}
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
    borderBottom: '1px solid var(--border-soft)',
    background: 'var(--bg-elevated)',
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
    color: 'var(--text-dim)',
}

const workspaceTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-strong)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const workspaceMetaStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    fontSize: 12,
    color: 'var(--text-muted)',
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
    border: '1px solid var(--border-soft)',
    borderRadius: 12,
    background: 'var(--bg-soft)',
}

const clusterLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-muted)',
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
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
    boxShadow: 'var(--shadow-soft)',
    zIndex: 20,
}

const overflowItemStyle: React.CSSProperties = {
    border: 'none',
    background: 'var(--bg-elevated)',
    borderRadius: 10,
    padding: '9px 10px',
    display: 'grid',
    gap: 2,
    textAlign: 'left',
}

const overflowDangerItemStyle: React.CSSProperties = {
    background: 'var(--danger-bg)',
}

const overflowItemLabelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-strong)',
}

const overflowItemHintStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: 1.4,
    color: 'var(--text-muted)',
}

const toneStyles: Record<
    'neutral' | 'primary' | 'info' | 'danger' | 'quiet',
    { border: string; background: string; color: string; fontWeight: number }
> = {
    neutral: {
        border: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        color: 'var(--text-strong)',
        fontWeight: 500,
    },
    primary: {
        border: '1px solid var(--accent-border)',
        background: 'var(--accent-bg-strong)',
        color: 'var(--accent-text)',
        fontWeight: 700,
    },
    info: {
        border: '1px solid var(--accent-border)',
        background: 'var(--accent-bg)',
        color: 'var(--accent-text)',
        fontWeight: 600,
    },
    danger: {
        border: '1px solid var(--danger-border)',
        background: 'var(--danger-bg)',
        color: 'var(--danger-text)',
        fontWeight: 700,
    },
    quiet: {
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text)',
        fontWeight: 600,
    },
}
