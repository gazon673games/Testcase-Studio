import * as React from 'react'
import { joinClasses } from './previewUtils'
import { PreviewHint } from './PreviewPrimitives'

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
