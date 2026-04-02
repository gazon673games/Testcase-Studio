import * as React from 'react'

type AppErrorBoundaryProps = {
    title: string
    actionLabel: string
    children: React.ReactNode
}

type AppErrorBoundaryState = {
    error: Error | null
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = { error: null }

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error) {
        console.error('App render error:', error)
    }

    render() {
        if (!this.state.error) return this.props.children

        return (
            <div className="app-shell__loading">
                <h1>{this.props.title}</h1>
                <p className="app-shell__message">{this.state.error.message}</p>
                <div className="app-shell__actions">
                    <button type="button" className="overview-button" onClick={() => window.location.reload()}>
                        {this.props.actionLabel}
                    </button>
                </div>
            </div>
        )
    }
}
