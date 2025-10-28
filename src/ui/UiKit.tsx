// src/ui/UiKit.tsx
import * as React from 'react'

/** ───────────────────────── THEME ───────────────────────── */
export type Theme = {
    name: string
    colors: {
        fg: string
        bg: string
        border: string
        primary: string
        primaryFg: string
        muted: string
        mutedFg: string
        successBg: string; successBorder: string; successFg: string
        infoBg: string; infoBorder: string; infoFg: string
        errorBg: string; errorBorder: string; errorFg: string
        focus: string
    }
    radius: number
}

export const lightTheme: Theme = {
    name: 'light',
    colors: {
        fg: '#111',
        bg: '#fff',
        border: '#e5e5e5',
        primary: '#1677ff',
        primaryFg: '#fff',
        muted: '#f7f7f7',
        mutedFg: '#555',
        successBg: '#e8f5e9', successBorder: '#c8e6c9', successFg: '#256029',
        infoBg: '#eef5ff', infoBorder: '#c5dafc', infoFg: '#26477a',
        errorBg: '#ffebee', errorBorder: '#ffcdd2', errorFg: '#8a1f2d',
        focus: '#8ab4f8'
    },
    radius: 10,
}

const ThemeCtx = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null)
export function useTheme() {
    const ctx = React.useContext(ThemeCtx)
    if (!ctx) throw new Error('useTheme must be used within <UiKit/>')
    return ctx
}

/** ───────────────────────── GLOBAL STYLES ─────────────────────────
 *  Глобальный эффект нажатия применяется ко ВСЕМ <button>,
 *  КРОМЕ кнопок со спойлерами и явным opt-out:
 *   - button[data-spoiler]
 *   - button[data-nopress]
 */
function GlobalStyles({ theme }: { theme: Theme }) {
    const css = `
  :root{
    --fg:${theme.colors.fg}; --bg:${theme.colors.bg}; --border:${theme.colors.border};
    --primary:${theme.colors.primary}; --primary-fg:${theme.colors.primaryFg};
    --muted:${theme.colors.muted}; --muted-fg:${theme.colors.mutedFg};
    --focus:${theme.colors.focus};
    --radius:${theme.radius}px;

    --toast-info-bg:${theme.colors.infoBg}; --toast-info-br:${theme.colors.infoBorder}; --toast-info-fg:${theme.colors.infoFg};
    --toast-ok-bg:${theme.colors.successBg}; --toast-ok-br:${theme.colors.successBorder}; --toast-ok-fg:${theme.colors.successFg};
    --toast-err-bg:${theme.colors.errorBg}; --toast-err-br:${theme.colors.errorBorder}; --toast-err-fg:${theme.colors.errorFg};
  }

  html, body { color: var(--fg); background: var(--bg); }
  button:not([data-nopress]):not([data-spoiler]) {
    transition: transform .06s ease, filter .06s ease, box-shadow .12s ease, background-color .12s ease, border-color .12s ease;
    will-change: transform;
  }
  button:not([data-nopress]):not([data-spoiler]):active {
    transform: translateY(1px) scale(0.98);
    filter: saturate(0.92) brightness(0.98);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgba(138,180,248,.25);
  }
  `
    return <style dangerouslySetInnerHTML={{ __html: css }} />
}

/** ───────────────────────── TOASTS ───────────────────────── */
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
        <div style={{
            position:'fixed', right:14, top:14, zIndex:99999, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none'
        }}>
            {items.map(t => {
                const by: Record<ToastKind, React.CSSProperties> = {
                    info:    { borderColor:'var(--toast-info-br)', background:'var(--toast-info-bg)', color:'var(--toast-info-fg)' },
                    success: { borderColor:'var(--toast-ok-br)',   background:'var(--toast-ok-bg)',   color:'var(--toast-ok-fg)'   },
                    error:   { borderColor:'var(--toast-err-br)',  background:'var(--toast-err-bg)',  color:'var(--toast-err-fg)'  },
                }
                return (
                    <div key={t.id} style={{
                        pointerEvents:'auto', display:'flex', alignItems:'center', gap:8,
                        padding:'8px 10px', borderRadius:12, border:'1px solid',
                        boxShadow:'0 8px 30px rgba(0,0,0,.12)', fontSize:13, ...by[t.kind]
                    }}>
                        <span>{t.kind === 'info' ? 'ℹ️' : t.kind === 'success' ? '✅' : '⛔'}</span>
                        <span style={{ lineHeight:1.2 }}>{t.text}</span>
                        <button data-nopress onClick={() => remove(t.id)} style={{ marginLeft:8, border:'none', background:'transparent', cursor:'pointer' }}>✖</button>
                    </div>
                )
            })}
        </div>
    )
}

/** ───────────────────────── UI KIT WRAPPER ───────────────────────── */
export function UiKit({ children, theme: initial = lightTheme }: { children: React.ReactNode; theme?: Theme }) {
    const [theme, setTheme] = React.useState<Theme>(initial)
    const [items, setItems] = React.useState<Toast[]>([])

    const push = React.useCallback((t: Omit<Toast, 'id'>) => {
        const id = crypto.randomUUID()
        const toast: Toast = { id, dismissOnAction: true, ttl: 2500, ...t }
        setItems(arr => [...arr, toast])

        const timer = window.setTimeout(() => setItems(arr => arr.filter(x => x.id !== id)), toast.ttl)
        // dismiss on any user action
        if (toast.dismissOnAction !== false) {
            const drop = () => { clearTimeout(timer); setItems(arr => arr.filter(x => x.id !== id)) }
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

    const remove = (id: string) => setItems(arr => arr.filter(x => x.id !== id))

    return (
        <ThemeCtx.Provider value={{ theme, setTheme }}>
            <ToastCtx.Provider value={{ push }}>
                <GlobalStyles theme={theme} />
                {children}
                <ToastViewport items={items} remove={remove} />
            </ToastCtx.Provider>
        </ThemeCtx.Provider>
    )
}
