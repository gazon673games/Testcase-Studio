import * as React from 'react'
import type { TreeTranslate } from './types'

type Props = {
    open: boolean
    itemName: string
    itemKind: 'folder' | 'test'
    alias: string
    t: TreeTranslate
    onClose(): void
    onApply(alias: string | null): void
}

export function TreeAliasModal({ open, itemName, itemKind, alias, t, onClose, onApply }: Props) {
    const [draftAlias, setDraftAlias] = React.useState(alias)
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        setDraftAlias(alias)
    }, [alias, open])

    React.useEffect(() => {
        if (!open) return
        const timer = window.setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
        }, 0)
        return () => window.clearTimeout(timer)
    }, [open])

    React.useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, open])

    if (!open) return null

    const subtitle = itemKind === 'folder'
        ? t('tree.aliasForFolder', { name: itemName || t('tree.untitled') })
        : t('tree.aliasForTest', { name: itemName || t('tree.untitled') })

    return (
        <div className="tree-icon-modal__backdrop" onMouseDown={onClose}>
            <div
                className="tree-icon-modal tree-alias-modal"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tree-alias-title"
            >
                <div className="tree-icon-modal__header">
                    <div className="tree-icon-modal__title-wrap">
                        <h3 id="tree-alias-title" className="tree-icon-modal__title">
                            {t('tree.setAlias')}
                        </h3>
                        <div className="tree-icon-modal__subtitle">{subtitle}</div>
                    </div>
                    <button type="button" className="tree-icon-modal__close" onClick={onClose} title={t('tree.iconPickerClose')}>
                        x
                    </button>
                </div>

                <div className="tree-icon-modal__body">
                    <label className="tree-alias-modal__field">
                        <span className="tree-alias-modal__label">{t('editor.alias')}</span>
                        <input
                            ref={inputRef}
                            value={draftAlias}
                            onChange={(event) => setDraftAlias(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault()
                                    onApply(draftAlias || null)
                                }
                            }}
                            className="tree-alias-modal__input"
                            placeholder={t('tree.aliasPlaceholder')}
                        />
                    </label>
                </div>

                <div className="tree-icon-modal__actions">
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--secondary" onClick={onClose}>
                        {t('tree.iconPickerCancel')}
                    </button>
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--secondary" onClick={() => setDraftAlias('')}>
                        {t('tree.clearAlias')}
                    </button>
                    <button type="button" className="tree-icon-modal__button tree-icon-modal__button--primary" onClick={() => onApply(draftAlias || null)}>
                        {t('tree.iconPickerApply')}
                    </button>
                </div>
            </div>
        </div>
    )
}
