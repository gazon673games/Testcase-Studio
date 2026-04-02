import * as React from 'react'
import type { PreviewStepDiffEntry, PreviewStepDiffRow } from '@core/previewDiff'
import './PreviewDialog.css'
import { useUiPreferences } from '../preferences'

type ButtonTone = 'primary' | 'danger' | 'ghost' | 'soft'
type BadgeTone = 'neutral' | 'ok' | 'info' | 'warn' | 'muted'
type AlertTone = 'error' | 'warning'
type DiffSide = 'local' | 'remote'

type PreviewDialogProps = {
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
}: PreviewDialogProps) {
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
            onMouseDown={() => {
                if (canDismiss) onClose()
            }}
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

export function PreviewDialogSplit({
    sidebar,
    content,
    className,
}: {
    sidebar: React.ReactNode
    content: React.ReactNode
    className?: string
}) {
    return (
        <div className={joinClasses('preview-dialog__split', className)}>
            <div className="preview-dialog__sidebar">{sidebar}</div>
            <div className="preview-dialog__content">{content}</div>
        </div>
    )
}

export function PreviewCard({
    title,
    children,
    className,
}: {
    title?: React.ReactNode
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={joinClasses('preview-dialog__card', className)}>
            {title ? <div className="preview-dialog__card-title">{title}</div> : null}
            {children}
        </div>
    )
}

export function PreviewField({
    label,
    children,
    className,
}: {
    label: React.ReactNode
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={joinClasses('preview-dialog__field', className)}>
            <div className="preview-dialog__label">{label}</div>
            {children}
        </div>
    )
}

export const PreviewButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        tone?: ButtonTone
        className?: string
    }
>(function PreviewButton(
    {
        tone = 'primary',
        children,
        className,
        ...props
    },
    ref
) {
    return (
        <button
            ref={ref}
            type={props.type ?? 'button'}
            {...props}
            className={joinClasses('preview-dialog__button', `preview-dialog__button--${tone}`, className)}
        >
            {children}
        </button>
    )
})

export function PreviewBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
    return <span className={joinClasses('preview-dialog__badge', `preview-dialog__badge--${tone}`)}>{children}</span>
}

export function PreviewAlert({ tone, children }: { tone: AlertTone; children: React.ReactNode }) {
    return <div className={joinClasses('preview-dialog__alert', `preview-dialog__alert--${tone}`)}>{children}</div>
}

export function PreviewHint({ children }: { children: React.ReactNode }) {
    return <div className="preview-dialog__hint">{children}</div>
}

export function PreviewInfoGrid({ children }: { children: React.ReactNode }) {
    return <div className="preview-dialog__info-grid">{children}</div>
}

export function PreviewInfoPair({ label, value }: { label: string; value: string }) {
    return (
        <div className="preview-dialog__info-pair">
            <div className="preview-dialog__info-label">{label}</div>
            <div className="preview-dialog__info-value">{value}</div>
        </div>
    )
}

export function PreviewToolbar({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return <div className={joinClasses('preview-dialog__toolbar', className)}>{children}</div>
}

export function PreviewToolbarGroup({
    children,
    className,
    align = 'start',
}: {
    children: React.ReactNode
    className?: string
    align?: 'start' | 'end'
}) {
    return (
        <div
            className={joinClasses(
                'preview-dialog__toolbar-group',
                align === 'end' && 'preview-dialog__toolbar-group--end',
                className
            )}
        >
            {children}
        </div>
    )
}

export const PreviewFilterChip = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        active?: boolean
        className?: string
    }
>(function PreviewFilterChip({ active = false, children, className, ...props }, ref) {
    return (
        <button
            ref={ref}
            type={props.type ?? 'button'}
            {...props}
            className={joinClasses(
                'preview-dialog__filter-chip',
                active && 'preview-dialog__filter-chip--active',
                className
            )}
        >
            {children}
        </button>
    )
})

export function PreviewStickyBar({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return <div className={joinClasses('preview-dialog__sticky-bar', className)}>{children}</div>
}

export function PreviewEmptyState({
    title,
    children,
}: {
    title: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <PreviewCard className="preview-dialog__empty" title={title}>
            <PreviewHint>{children}</PreviewHint>
        </PreviewCard>
    )
}

export function PreviewDiffCard({
    title,
    leftLabel,
    rightLabel,
    leftText,
    rightText,
    stepRows,
    leftSide = 'local',
    rightSide = 'remote',
}: {
    title: string
    leftLabel: string
    rightLabel: string
    leftText: string
    rightText: string
    stepRows?: PreviewStepDiffRow[]
    leftSide?: DiffSide
    rightSide?: DiffSide
}) {
    const { t } = useUiPreferences()
    return (
        <div className="preview-dialog__diff-card">
            <div className="preview-dialog__diff-title">{title}</div>
            <div className="preview-dialog__diff-columns">
                <div>
                    <div className="preview-dialog__diff-label">{leftLabel}</div>
                    <div className="preview-dialog__diff-text">{leftText}</div>
                </div>
                <div>
                    <div className="preview-dialog__diff-label">{rightLabel}</div>
                    <div className="preview-dialog__diff-text">{rightText}</div>
                </div>
            </div>

            {stepRows?.length ? (
                <div className="preview-dialog__step-list">
                    {stepRows.map((row) => (
                        <div
                            key={`${title}-${row.index}`}
                            className="preview-dialog__step-row"
                            data-changed={row.changed ? 'true' : 'false'}
                        >
                            <div className="preview-dialog__step-index">{t('preview.step', { index: row.index })}</div>
                            <div className="preview-dialog__step-columns">
                                <PreviewStepEntryCard entry={row[leftSide]} emptyLabel={t('preview.noSideStep', { label: leftLabel.toLowerCase() })} />
                                <PreviewStepEntryCard entry={row[rightSide]} emptyLabel={t('preview.noSideStep', { label: rightLabel.toLowerCase() })} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

function PreviewStepEntryCard({
    entry,
    emptyLabel,
}: {
    entry?: PreviewStepDiffEntry
    emptyLabel: string
}) {
    if (!entry) {
        return (
            <div className="preview-dialog__step-entry" data-empty="true">
                <div className="preview-dialog__step-summary">{emptyLabel}</div>
            </div>
        )
    }

    return (
        <div className="preview-dialog__step-entry">
            <div className="preview-dialog__step-summary">{entry.summary}</div>
            <PreviewStepField label="Action" value={entry.action} />
            <PreviewStepField label="Data" value={entry.data} />
            <PreviewStepField label="Expected" value={entry.expected} />
        </div>
    )
}

function PreviewStepField({ label, value }: { label: string; value: string }) {
    const { t } = useUiPreferences()
    const localizedLabel =
        label === 'Action' ? t('preview.action') : label === 'Data' ? t('preview.data') : label === 'Expected' ? t('preview.expected') : label
    return (
        <div className="preview-dialog__step-field">
            <div className="preview-dialog__step-field-label">{localizedLabel}</div>
            <div className="preview-dialog__step-field-value">{value}</div>
        </div>
    )
}

function getFocusable(container: HTMLElement | null): HTMLElement[] {
    if (!container) return []
    const selector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hasAttribute('hidden') && element.tabIndex !== -1
    )
}

function joinClasses(...parts: Array<string | undefined | false>) {
    return parts.filter(Boolean).join(' ')
}
