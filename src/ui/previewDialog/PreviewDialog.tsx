import * as React from 'react'
import { useUiPreferences } from '../preferences'
import { getFocusable } from './previewUtils'

type Props = {
    open: boolean
    title: string
    subtitle?: React.ReactNode
    onClose(): void
    children: React.ReactNode
    initialFocusRef?: React.RefObject<HTMLElement | null>
    canDismiss?: boolean
}

export function PreviewDialog({
    open,
    title,
    subtitle,
    onClose,
    children,
    initialFocusRef,
    canDismiss = true,
}: Props) {
    const { t } = useUiPreferences()
    const dialogRef = React.useRef<HTMLDivElement | null>(null)
    const titleId = React.useId()
    const subtitleId = React.useId()

    React.useEffect(() => {
        if (!open) return
        const previous = document.activeElement as HTMLElement | null
        const dialog = dialogRef.current

        const focusTarget = () => {
            const preferred = initialFocusRef?.current
            if (preferred && !preferred.hasAttribute('disabled')) {
                preferred.focus()
                return
            }
            const fallback = getFocusable(dialog)[0] ?? dialog
            fallback?.focus()
        }

        const frame = window.requestAnimationFrame(focusTarget)

        const onKeyDown = (event: KeyboardEvent) => {
            if (!dialog) return
            if (event.key === 'Escape' && canDismiss) {
                event.preventDefault()
                onClose()
                return
            }
            if (event.key !== 'Tab') return

            const focusables = getFocusable(dialog)
            if (!focusables.length) {
                event.preventDefault()
                dialog.focus()
                return
            }

            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            const active = document.activeElement as HTMLElement | null

            if (event.shiftKey) {
                if (!active || active === first || !dialog.contains(active)) {
                    event.preventDefault()
                    last.focus()
                }
                return
            }

            if (!active || active === last || !dialog.contains(active)) {
                event.preventDefault()
                first.focus()
            }
        }

        dialog?.addEventListener('keydown', onKeyDown)

        return () => {
            window.cancelAnimationFrame(frame)
            dialog?.removeEventListener('keydown', onKeyDown)
            previous?.focus?.()
        }
    }, [open, onClose, canDismiss, initialFocusRef])

    if (!open) return null

    return (
        <div
            className="preview-dialog__backdrop"
            onMouseDown={() => { if (canDismiss) onClose() }}
        >
            <div
                ref={dialogRef}
                className="preview-dialog__surface"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitle ? subtitleId : undefined}
                tabIndex={-1}
            >
                <div className="preview-dialog__header">
                    <div>
                        <div id={titleId} className="preview-dialog__title">{title}</div>
                        {subtitle ? <div id={subtitleId} className="preview-dialog__subtitle">{subtitle}</div> : null}
                    </div>
                    <button
                        type="button"
                        className="preview-dialog__close"
                        onClick={onClose}
                        disabled={!canDismiss}
                        aria-label={t('preview.closeDialog')}
                    >
                        x
                    </button>
                </div>
                <div className="preview-dialog__body">{children}</div>
            </div>
        </div>
    )
}
