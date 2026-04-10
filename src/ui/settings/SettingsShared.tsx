import * as React from 'react'

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <label className="settings-modal__field">
            <div className="settings-modal__label">{label}</div>
            {children}
        </label>
    )
}

export function TabButton({
    active,
    children,
    onClick,
}: {
    active: boolean
    children: React.ReactNode
    onClick(): void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`settings-modal__tab${active ? ' settings-modal__tab--active' : ''}`}
        >
            {children}
        </button>
    )
}

export function Alert({ tone, children }: { tone: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
    return <div className={`settings-modal__alert settings-modal__alert--${tone}`}>{children}</div>
}
