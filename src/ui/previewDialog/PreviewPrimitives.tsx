import * as React from 'react'
import { joinClasses } from './previewUtils'

type ButtonTone = 'primary' | 'danger' | 'ghost' | 'soft'
type BadgeTone = 'neutral' | 'ok' | 'info' | 'warn' | 'muted'
type AlertTone = 'error' | 'warning'

export const PreviewButton = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        tone?: ButtonTone
        className?: string
    }
>(function PreviewButton({ tone = 'primary', children, className, ...props }, ref) {
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
