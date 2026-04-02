import * as React from 'react'

type Props = {
    title: string
    message?: string | null
    actionLabel?: string
    onAction?(): void
}

export function AppShellStatus({ title, message, actionLabel, onAction }: Props) {
    return (
        <div className="app-shell__loading">
            <h1>{title}</h1>
            {message ? <p className="app-shell__message">{message}</p> : null}
            {actionLabel && onAction ? (
                <div className="app-shell__actions">
                    <button type="button" className="overview-button" onClick={onAction}>
                        {actionLabel}
                    </button>
                </div>
            ) : null}
        </div>
    )
}
