// src/ui/Settings.tsx
import * as React from 'react'
import { apiClient } from '@ipc/client'
import type { AtlassianSettings } from '@core/settings'

type Props = { open: boolean; onClose(): void }

const TABS = [{ key: 'atlassian', label: 'Atlassian Sync' }] as const
type TabKey = typeof TABS[number]['key']

export function SettingsModal({ open, onClose }: Props) {
    const [tab, setTab] = React.useState<TabKey>('atlassian')
    const [loading, setLoading] = React.useState(true)
    const [email, setEmail] = React.useState('')
    const [secret, setSecret] = React.useState('')
    const [hasSecret, setHasSecret] = React.useState(false)
    const [saved, setSaved] = React.useState<'idle' | 'ok' | 'err'>('idle')
    const [showSecret, setShowSecret] = React.useState(false)
    const emailRef = React.useRef<HTMLInputElement | null>(null)
    const secretRef = React.useRef<HTMLInputElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        setLoading(true); setSaved('idle'); setSecret('')
        apiClient.loadSettings()
            .then((s: AtlassianSettings) => { setEmail(s.email); setHasSecret(s.hasSecret) })
            .finally(() => setLoading(false))
    }, [open])

    // Esc для закрытия
    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    // автофокус
    React.useEffect(() => {
        if (!open || loading) return
        const el = (email ? secretRef.current : emailRef.current)
        el?.focus()
    }, [open, loading, email])

    const canSave =
        email.trim().length > 0 &&
        (!hasSecret ? secret.trim().length > 0 : true) &&
        !loading

    async function save(e?: React.FormEvent) {
        e?.preventDefault()
        if (!canSave) return
        try {
            setLoading(true)
            const s = await apiClient.saveSettings(email.trim(), secret || undefined)
            setHasSecret(s.hasSecret)
            setSaved('ok')
            setSecret('')
        } catch {
            setSaved('err')
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div style={backdrop} onMouseDown={onClose}>
            <div
                style={modal}
                onMouseDown={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
            >
                <div style={header}>
                    <h3 id="settings-title" style={{ margin: 0 }}>Settings</h3>
                    <button onClick={onClose} style={xBtn} title="Close">✖</button>
                </div>

                <div style={body}>
                    {/* tabs (слева) */}
                    <div style={sidebar}>
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{ ...tabBtn, ...(tab === t.key ? tabBtnActive : {}) }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* контент — занимает всё пространство справа */}
                    <div style={contentArea}>
                        <form onSubmit={save} style={formCard}>
                            {tab === 'atlassian' && (
                                loading ? <div>Loading…</div> : (
                                    <>
                                        <h4 style={{ margin: '0 0 14px', fontSize: 16 }}>Atlassian Sync</h4>

                                        {saved === 'ok' && <div style={alertOk}>Saved to OS keychain</div>}
                                        {saved === 'err' && <div style={alertErr}>Failed to save. Try again.</div>}

                                        <label style={label}>Atlassian login</label>
                                        <input
                                            ref={emailRef}
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            style={input}
                                            autoComplete="username"
                                        />

                                        <label style={label}>
                                            Password
                                            {hasSecret && <span style={chip}>stored</span>}
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                ref={secretRef}
                                                value={secret}
                                                onChange={e => setSecret(e.target.value)}
                                                style={{ ...input}}
                                                placeholder={hasSecret ? '•••••• (enter to replace)' : ''}
                                                type={showSecret ? 'text' : 'password'}
                                                autoComplete="current-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecret(s => !s)}
                                                style={eyeBtn}
                                                aria-label={showSecret ? 'Hide' : 'Show'}
                                            >
                                                {showSecret ? '🙈' : '👁️'}
                                            </button>
                                        </div>

                                        <div style={alertInfo}>
                                            Мы сохраняем логин в <code>.settings.json</code> внутри репозитория,
                                            а секрет — в системном хранилище (Keychain / Credential Manager).
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                            <button type="submit" disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.6 }}>
                                                Save
                                            </button>
                                            <button type="button" onClick={onClose}>Close</button>
                                        </div>
                                    </>
                                )
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* styles */
const backdrop: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
}
const modal: React.CSSProperties = {
    width: '70vw', maxWidth: 1000, height: '70vh', maxHeight: 800,
    background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
}
const header: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center' }
const xBtn: React.CSSProperties = { marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }

const body: React.CSSProperties = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    minHeight: 0
}

const sidebar: React.CSSProperties = {
    borderRight: '1px solid #eee',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6
}
const tabBtn: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 0px 8px 10px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer'
}
const tabBtnActive: React.CSSProperties = { background: 'rgba(0,0,0,0.06)', borderColor: '#ddd', fontWeight: 600 }

/* ПРАВАЯ ЧАСТЬ: тянется на всю ширину; форма — width:100% */
const contentArea: React.CSSProperties = {
    flex: 1,
    background: '#fafafa',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 20,
    overflow: 'auto'
}
const formCard: React.CSSProperties = {
    width: '100%',
    maxWidth: 860,            // безопасный максимум, чтобы на очень широких окнах не расползалось
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#555', marginTop: 10 }

/* инпуты стилизованы как alertInfo: одинаковый размер шрифта, padding и скругление */
const input: React.CSSProperties = {
    width: '100%',
    padding: '8px 0px 8px 10px',
    marginTop: 4,
    border: '1px solid #ccc',
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color .15s',
    fontSize: 13,
    lineHeight: 1.4
}

const btnPrimary: React.CSSProperties = {
    padding: '6px 14px',
    background: '#1677ff',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 500,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    transition: 'background .2s'
}

const chip: React.CSSProperties = {
    marginLeft: 8,
    color: '#0a0',
    background: 'rgba(0,128,0,.08)',
    border: '1px solid #cfe9cf',
    padding: '0 6px',
    borderRadius: 999,
    fontSize: 12
}

const eyeBtn: React.CSSProperties = {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    border: 'none',
    background: 'transparent',
    color: '#666',
    cursor: 'pointer',
    fontSize: 14
}

const alertOk: React.CSSProperties = { background: '#e8f5e9', border: '1px solid #c8e6c9', color: '#256029', padding: '6px 8px', borderRadius: 8, marginBottom: 8 }
const alertErr: React.CSSProperties = { background: '#ffebee', border: '1px solid #ffcdd2', color: '#8a1f2d', padding: '6px 8px', borderRadius: 8, marginBottom: 8 }
const alertInfo: React.CSSProperties = {
    background: '#eef5ff',
    border: '1px solid #c5dafc',
    color: '#26477a',
    padding: '8px 0px 8px 10px',
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.4,
    marginTop: 6
}
