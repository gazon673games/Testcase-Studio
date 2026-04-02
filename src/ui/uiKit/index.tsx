import * as React from 'react'
import './UiKit.css'

type ToastKind = 'info' | 'success' | 'error'
type Toast = { id: string; kind: ToastKind; text: string; ttl?: number; dismissOnAction?: boolean }
type ToastCtxT = { push(t: Omit<Toast, 'id'>): void }

const ToastCtx = React.createContext<ToastCtxT | null>(null)

export function useToast() {
    const ctx = React.useContext(ToastCtx)
    if (!ctx) throw new Error('useToast must be used within <UiKit/>')
    return ctx
}

function ToastViewport({ items, remove }: { items: Toast[]; remove(id: string): void }) {
    return (
        <div className="ui-kit__toast-viewport">
            {items.map((toast) => {
                return (
                    <div key={toast.id} className={`ui-kit__toast ui-kit__toast--${toast.kind}`}>
                        <span className="ui-kit__toast-icon">
                            {toast.kind === 'info' ? 'i' : toast.kind === 'success' ? 'OK' : '!'}
                        </span>
                        <span className="ui-kit__toast-text">{toast.text}</span>
                        <button
                            data-nopress
                            type="button"
                            onClick={() => remove(toast.id)}
                            className="ui-kit__toast-close"
                        >
                            x
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

export function UiKit({ children }: { children: React.ReactNode }) {
    const [items, setItems] = React.useState<Toast[]>([])

    const push = React.useCallback((toast: Omit<Toast, 'id'>) => {
        const id = crypto.randomUUID()
        const next: Toast = { id, dismissOnAction: true, ttl: 2500, ...toast }
        setItems((current) => [...current, next])

        if ((next.ttl ?? 0) > 0) {
            window.setTimeout(() => {
                setItems((current) => current.filter((item) => item.id !== id))
            }, next.ttl)
        }
    }, [])

    const remove = React.useCallback((id: string) => {
        setItems((current) => current.filter((item) => item.id !== id))
    }, [])

    return (
        <ToastCtx.Provider value={{ push }}>
            {children}
            <ToastViewport items={items} remove={remove} />
        </ToastCtx.Provider>
    )
}
