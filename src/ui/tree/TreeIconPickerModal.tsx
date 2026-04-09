import * as React from 'react'
import type { LocalTreeIconOption } from '@shared/treeIcons'
import type { TreeTranslate } from './types'

type Props = {
    open: boolean
    itemName: string
    itemKind: 'folder' | 'test'
    icons: LocalTreeIconOption[]
    selectedKey: string | null
    t: TreeTranslate
    onImport(): Promise<LocalTreeIconOption | null>
    onDelete(iconKey: string): Promise<boolean>
    onClose(): void
    onApply(iconKey: string | null): void
}

export function TreeIconPickerModal({ open, itemName, itemKind, icons, selectedKey, t, onImport, onDelete, onClose, onApply }: Props) {
    const [draftKey, setDraftKey] = React.useState<string | null>(selectedKey)
    const [importing, setImporting] = React.useState(false)
    const [deletingKey, setDeletingKey] = React.useState<string | null>(null)
    const [modalError, setModalError] = React.useState<{ kind: 'import' | 'delete'; message: string } | null>(null)

    React.useEffect(() => {
        if (!open) return
        setDraftKey(selectedKey)
        setDeletingKey(null)
        setModalError(null)
    }, [open, selectedKey])

    React.useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, open])

    if (!open) return null

    const itemLabel = itemKind === 'folder'
        ? t('tree.iconPickerForFolder', { name: itemName || t('tree.untitled') })
        : t('tree.iconPickerForTest', { name: itemName || t('tree.untitled') })

    return (
        <div className="tree-icon-modal__backdrop" onMouseDown={onClose}>
            <div
                className="tree-icon-modal"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tree-icon-picker-title"
            >
                <div className="tree-icon-modal__header">
                    <div className="tree-icon-modal__title-wrap">
                        <h3 id="tree-icon-picker-title" className="tree-icon-modal__title">
                            {t('tree.iconPickerTitle')}
                        </h3>
                        <div className="tree-icon-modal__subtitle">{itemLabel}</div>
                    </div>
                    <button type="button" className="tree-icon-modal__close" onClick={onClose} title={t('tree.iconPickerClose')}>
                        x
                    </button>
                </div>

                <div className="tree-icon-modal__body">
                    <div className="tree-icon-modal__hint">{t('tree.iconPickerHint')}</div>
                    <div className="tree-icon-modal__toolbar">
                        <button
                            type="button"
                            className="tree-icon-modal__button tree-icon-modal__button--secondary"
                            disabled={importing}
                            onClick={() => {
                                void (async () => {
                                    setImporting(true)
                                    setModalError(null)
                                    try {
                                        const imported = await onImport()
                                        if (imported) setDraftKey(imported.key)
                                    } catch (error) {
                                        setModalError({
                                            kind: 'import',
                                            message: error instanceof Error ? error.message : String(error),
                                        })
                                    } finally {
                                        setImporting(false)
                                    }
                                })()
                            }}
                        >
                            {importing ? t('tree.iconPickerImporting') : t('tree.iconPickerImport')}
                        </button>
                    </div>
                    {modalError ? (
                        <div className="tree-icon-modal__error">
                            {modalError.kind === 'import'
                                ? t('tree.iconPickerImportFailed', { message: modalError.message })
                                : t('tree.iconPickerDeleteFailed', { message: modalError.message })}
                        </div>
                    ) : null}
                    {icons.length === 0 ? (
                        <div className="tree-icon-modal__empty">{t('tree.iconPickerEmpty')}</div>
                    ) : (
                        <div className="tree-icon-modal__grid">
                            <div
                                role="button"
                                tabIndex={0}
                                className={`tree-icon-option${!draftKey ? ' is-selected' : ''}`}
                                onClick={() => setDraftKey(null)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        setDraftKey(null)
                                    }
                                }}
                            >
                                <span className="tree-icon-option__placeholder">{t('tree.iconPickerDefault')}</span>
                                <span className="tree-icon-option__label">{t('tree.iconPickerDefault')}</span>
                            </div>
                            {icons.map((icon) => (
                                <div
                                    key={icon.key}
                                    role="button"
                                    tabIndex={0}
                                    className={`tree-icon-option${draftKey === icon.key ? ' is-selected' : ''}`}
                                    onClick={() => setDraftKey(icon.key)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            setDraftKey(icon.key)
                                        }
                                    }}
                                    title={icon.label}
                                >
                                    <button
                                        type="button"
                                    className="tree-icon-option__delete"
                                    title={t('tree.iconPickerDelete')}
                                    aria-label={t('tree.iconPickerDelete')}
                                    disabled={deletingKey === icon.key}
                                    onClick={(event) => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        if (!window.confirm(t('tree.iconPickerDeleteConfirm', { name: icon.label }))) return
                                        void (async () => {
                                            setDeletingKey(icon.key)
                                            setModalError(null)
                                            try {
                                                await onDelete(icon.key)
                                                if (draftKey === icon.key) setDraftKey(null)
                                            } catch (error) {
                                                setModalError({
                                                    kind: 'delete',
                                                    message: error instanceof Error ? error.message : String(error),
                                                })
                                            } finally {
                                                setDeletingKey((current) => (current === icon.key ? null : current))
                                            }
                                        })()
                                    }}
                                    >
                                        {deletingKey === icon.key ? '...' : 'x'}
                                    </button>
                                    <img className="tree-icon-option__image" src={icon.dataUrl} alt="" />
                                    <span className="tree-icon-option__label">{icon.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="tree-icon-modal__actions">
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--secondary" onClick={onClose}>
                        {t('tree.iconPickerCancel')}
                    </button>
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--secondary" onClick={() => setDraftKey(null)}>
                        {t('tree.clearIcon')}
                    </button>
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--primary" onClick={() => onApply(draftKey)}>
                        {t('tree.iconPickerApply')}
                    </button>
                </div>
            </div>
        </div>
    )
}
