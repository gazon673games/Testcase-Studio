import * as React from 'react'

type ToastKind = 'info' | 'success' | 'error'
type Toast = { id: string; kind: ToastKind; text: string; ttl?: number; dismissOnAction?: boolean }
type ToastCtxT = { push(t: Omit<Toast, 'id'>): void }

const ToastCtx = React.createContext<ToastCtxT | null>(null)

function GlobalStyles() {
    const css = `
  html, body { color: var(--text); background: var(--bg); }
  button:not([data-nopress]):not([data-spoiler]) {
    transition: transform .06s ease, filter .06s ease, box-shadow .12s ease, background-color .12s ease, border-color .12s ease;
    will-change: transform;
  }
  button:not([data-nopress]):not([data-spoiler]):active {
    transform: translateY(1px) scale(0.98);
    filter: saturate(0.92) brightness(0.98);
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--accent-border);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  `
    return <style dangerouslySetInnerHTML={{ __html: css }} />
}

export function useToast() {
    const ctx = React.useContext(ToastCtx)
    if (!ctx) throw new Error('useToast must be used within <UiKit/>')
    return ctx
}

function ToastViewport({ items, remove }: { items: Toast[]; remove(id: string): void }) {
    return (
        <div style={{
            position: 'fixed',
            right: 14,
            top: 14,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
        }}>
            {items.map((toast) => {
                const by: Record<ToastKind, React.CSSProperties> = {
                    info: { borderColor: 'var(--info-border)', background: 'var(--info-bg)', color: 'var(--info-text)' },
                    success: { borderColor: 'var(--success-border)', background: 'var(--success-bg)', color: 'var(--success-text)' },
                    error: { borderColor: 'var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-text)' },
                }
                return (
                    <div key={toast.id} style={{
                        pointerEvents: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 12,
                        border: '1px solid',
                        boxShadow: 'var(--shadow-soft)',
                        fontSize: 13,
                        ...by[toast.kind],
                    }}>
                        <span>{toast.kind === 'info' ? 'i' : toast.kind === 'success' ? 'OK' : '!'}</span>
                        <span style={{ lineHeight: 1.2 }}>{toast.text}</span>
                        <button
                            data-nopress
                            type="button"
                            onClick={() => remove(toast.id)}
                            style={{ marginLeft: 8, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
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
            <GlobalStyles />
            {children}
            <ToastViewport items={items} remove={remove} />
        </ToastCtx.Provider>
    )
}
