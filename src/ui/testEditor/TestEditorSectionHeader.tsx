import * as React from 'react'

type Props = {
    title: string
    open: boolean
    count?: number
    onToggle(): void
    right?: React.ReactNode
}

export function TestEditorSectionHeader({ title, open, count, onToggle, right }: Props) {
    return (
        <div className="section-header" data-spoiler data-nopress>
            <button type="button" onClick={onToggle}>
                <span className="section-header__toggle-icon">{open ? '-' : '+'}</span>
                <span>
                    {title}
                    {typeof count === 'number' ? ` (${count})` : ''}
                </span>
            </button>
            <span className="spacer" />
            {right}
        </div>
    )
}
