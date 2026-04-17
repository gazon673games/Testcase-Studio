import * as React from 'react'

type Props = {
    children: React.ReactNode
    onClose(): void
}

type State = { error: Error | null }

export class ModalErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    componentDidCatch(error: Error) {
        console.error('Modal render error:', error)
    }

    render() {
        if (!this.state.error) return this.props.children

        return (
            <div className="settings-modal__backdrop">
                <div className="settings-modal" role="alertdialog" aria-modal="true">
                    <div className="settings-modal__header">
                        <h3 className="settings-modal__title">Unexpected error</h3>
                        <button
                            type="button"
                            className="settings-modal__close"
                            onClick={this.props.onClose}
                        >
                            x
                        </button>
                    </div>
                    <div className="settings-modal__body" style={{ display: 'block', padding: '24px' }}>
                        <p style={{ color: 'var(--error-text, red)', margin: 0 }}>
                            {this.state.error.message}
                        </p>
                    </div>
                </div>
            </div>
        )
    }
}
