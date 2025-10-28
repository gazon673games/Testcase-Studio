// src/ui/Toast.tsx
import * as React from 'react'

type ToastKind = 'info' | 'success' | 'error'
type Toast = { id: string; kind: ToastKind; text: string; ttl: number; dismissOnAction?: boolean }

type Ctx = {
    push(t: Omit<Toast, 'id'>): void
}
const ToastCtx = React.createContext<Ctx | null>(null)

export function useToast() {
    const ctx = React.useContext(ToastCtx)
    if (!ctx) throw new Error('useToast must be used within <ToastProvider/>')
    return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = React.useState<Toast[]>([])

    const push = React.useCallback((t: Omit<Toast, 'id'>) => {
        const id = crypto.randomUUID()
        const toast: Toast = { id, dismissOnAction: true, ...t }
        setItems((arr) => [...arr, toast])

        // авто-диспоз по времени
        window.setTimeout(() => {
            setItems((arr) => arr.filter(x => x.id !== id))
        }, t.ttl ?? 2500)

        // “сброс при любом действии”
        if (toast.dismissOnAction !== false) {
            const drop = () => setItems((arr) => arr.filter(x => x.id !== id))
            const once = () => {
                drop()
                window.removeEventListener('pointerdown', once, true)
                window.removeEventListener('keydown', once, true)
                window.removeEventListener('wheel', once, { capture: true } as any)
            }
            window.addEventListener('pointerdown', once, true)
            window.addEventListener('keydown', once, true)
            window.addEventListener('wheel', once, { capture: true } as any)
        }
    }, [])

    return (
        <ToastCtx.Provider value={{ push }}>
            {children}
            <div style={viewport}>
                {items.map(t => (
                    <div key={t.id} style={{ ...card, ...byKind[t.kind] }}>
                        {iconByKind[t.kind]} <span style={{ lineHeight: 1.2 }}>{t.text}</span>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    )
}

/* styles */
const viewport: React.CSSProperties = {
    position: 'fixed', right: 14, top: 14, zIndex: 99999,
    display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none'
}
const card: React.CSSProperties = {
    pointerEvents: 'auto',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 10, border: '1px solid',
    boxShadow: '0 8px 30px rgba(0,0,0,.12)', background: '#fff', fontSize: 13
}
const byKind: Record<ToastKind, React.CSSProperties> = {
    info:    { borderColor: '#c5dafc', background: '#eef5ff', color: '#26477a' },
    success: { borderColor: '#cfe9cf', background: '#e8f5e9', color: '#256029' },
    error:   { borderColor: '#ffcdd2', background: '#ffebee', color: '#8a1f2d' }
}
const iconByKind: Record<ToastKind, string> = {
    info: 'ℹ️', success: '✅', error: '⛔'
}
