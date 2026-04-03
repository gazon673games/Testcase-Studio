import * as React from 'react'
import { useUiPreferences } from '../preferences'
import './Toolbar.css'

type Props = {
    selectionLabel: string
    importDestinationLabel: string
    publishSelectionLabel: string
    publishCount: number
    saveState: 'saved' | 'pending' | 'saving' | 'error'
    selectionKind: 'folder' | 'case'
    onAddFolder(): void
    onAddTest(): void
    onDelete(): void
    onSave(): void
    onPull?(): void
    onPush?(): void
    onExport(): void
    onOpenSettings(): void
    onToggleSyncCenter(): void
    onTogglePreviewMode?(): void
    syncCenterOpen: boolean
    canDelete?: boolean
    canExport?: boolean
    canPull?: boolean
    canPush?: boolean
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
    const saveStateLabel =
        props.saveState === 'saving'
            ? t('toolbar.saving')
            : props.saveState === 'pending'
                ? t('toolbar.unsavedChanges')
                : props.saveState === 'error'
                    ? t('toolbar.saveError')
                    : t('toolbar.saved')
    const saveButtonLabel =
        props.saveState === 'saving'
            ? t('toolbar.saving')
            : props.saveState === 'error'
                ? t('toolbar.retrySave')
                : t('toolbar.save')
    const saveButtonTitle =
        props.saveState === 'saving'
            ? t('toolbar.savingTitle')
            : props.saveState === 'pending'
                ? t('toolbar.savePendingTitle')
                : props.saveState === 'error'
                    ? t('toolbar.saveErrorTitle')
                    : t('toolbar.saveTitle')
    const saveButtonTone =
        props.saveState === 'saved'
            ? 'quiet'
            : props.saveState === 'saving'
                ? 'info'
                : 'primary'

    return (
        <div className="toolbar">
            <div className="toolbar__workspace">
                <div className="toolbar__workspace-eyebrow">{t('toolbar.editor')}</div>
                <div className="toolbar__workspace-title" title={props.selectionLabel}>
                    {props.selectionLabel}
                </div>
                <div className="toolbar__workspace-meta">
                    <span title={props.importDestinationLabel}>
                        {t('toolbar.importTarget', { label: props.importDestinationLabel })}
                    </span>
                    <span>{publishMeta}</span>
                    <span className={`toolbar__save-status toolbar__save-status--${props.saveState}`}>{saveStateLabel}</span>
                </div>
            </div>

            <div className="toolbar__actions">
                <ToolbarCluster label={t('toolbar.local')}>
                    <ToolbarButton
                        onClick={props.onSave}
                        tone={saveButtonTone}
                        title={saveButtonTitle}
                        disabled={props.saveState === 'saving'}
                    >
                        {saveButtonLabel}
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
                    {props.selectionKind === 'case' ? (
                        <>
                            <ToolbarButton
                                onClick={props.onPull}
                                tone="info"
                                disabled={!props.canPull}
                                title={t('sync.pullCurrent')}
                                aria-label={t('sync.pullCurrent')}
                                className="toolbar-button--icon-only"
                            >
                                <ToolbarIcon direction="down" />
                            </ToolbarButton>
                            <ToolbarButton
                                onClick={props.onPush}
                                tone="danger"
                                disabled={!props.canPush}
                                title={t('sync.pushCurrent')}
                                aria-label={t('sync.pushCurrent')}
                                className="toolbar-button--icon-only"
                            >
                                <ToolbarIcon direction="up" />
                            </ToolbarButton>
                        </>
                    ) : (
                        <>
                            <ToolbarButton onClick={props.onAddTest}>{t('toolbar.newCase')}</ToolbarButton>
                            <ToolbarButton onClick={props.onAddFolder} tone="quiet">
                                {t('toolbar.newFolder')}
                            </ToolbarButton>
                        </>
                    )}
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

function ToolbarIcon({ direction }: { direction: 'up' | 'down' }) {
    return (
        <svg
            className="toolbar-button__icon"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {direction === 'down' ? (
                <>
                    <path d="M8 2.5v8" />
                    <path d="M4.5 7.5 8 11l3.5-3.5" />
                    <path d="M3 13.5h10" />
                </>
            ) : (
                <>
                    <path d="M8 13.5v-8" />
                    <path d="M4.5 8.5 8 5l3.5 3.5" />
                    <path d="M3 2.5h10" />
                </>
            )}
        </svg>
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
        <div className="toolbar-cluster">
            <div className="toolbar-cluster__label">{label}</div>
            <div className="toolbar-cluster__buttons">{children}</div>
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
        <div ref={containerRef} className="toolbar-overflow">
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
                <div role="menu" aria-label={t('toolbar.moreMenu')} className="toolbar-overflow__menu">
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
            className={[
                'toolbar-overflow__item',
                tone === 'danger' ? 'toolbar-overflow__item--danger' : '',
            ].filter(Boolean).join(' ')}
        >
            <span className="toolbar-overflow__item-label">{label}</span>
            <span className="toolbar-overflow__item-hint">{hint}</span>
        </button>
    )
}

function ToolbarButton({
    tone = 'neutral',
    className,
    ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: 'neutral' | 'primary' | 'info' | 'danger' | 'quiet'
}) {
    return (
        <button
            type={buttonProps.type ?? 'button'}
            {...buttonProps}
            className={['toolbar-button', `toolbar-button--${tone}`, className].filter(Boolean).join(' ')}
        />
    )
}
