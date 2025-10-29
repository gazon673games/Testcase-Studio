import * as React from 'react'
import type { TestMeta } from '@core/domain'
import './MetaParamsPanel.css'

type Props = {
    meta: TestMeta
    onChange(m: TestMeta): void
}

export function ParamsPanel({ meta, onChange }: Props) {
    const m = meta ?? { tags: [] }
    const committed: Record<string, string> = (m as any).params ?? {}

    /* ───────────── TAGS ───────────── */
    const setTags = (tags: string[]) => onChange({ ...m, tags })

    /* ───────────── BASE FIELDS (status / priority / component) ───────────── */
    const baseKeys: Array<keyof TestMeta> = ['status', 'priority', 'component']

    const setBase = (key: keyof TestMeta, val: string) => {
        onChange({ ...m, [key]: val })
    }

    const removeBase = (key: keyof TestMeta) => {
        const next = { ...m }
        delete (next as any)[key]
        onChange(next)
    }

    /* ───────────── EXISTING CUSTOM PARAMS ───────────── */
    const updateExistingKey = (oldKey: string, newKey: string) => {
        const params = { ...committed }
        const val = params[oldKey]
        delete params[oldKey]
        const key = makeUniqueKey(newKey.trim(), new Set(Object.keys(params)))
        params[key] = val
        onChange({ ...(m as any), params } as TestMeta)
    }

    const updateExistingValue = (key: string, val: string) => {
        const params = { ...committed, [key]: val }
        onChange({ ...(m as any), params } as TestMeta)
    }

    const removeExisting = (key: string) => {
        const params = { ...committed }
        delete params[key]
        onChange({ ...(m as any), params } as TestMeta)
    }

    /* ───────────── DRAFT NEW PARAMS ───────────── */
    type Row = { key: string; value: string }
    const [draftRows, setDraftRows] = React.useState<Row[]>([])

    const addDraft = () => {
        const base = 'param'
        const existing = new Set([...Object.keys(committed), ...draftRows.map(r=>r.key)])
        const key = makeUniqueKey(base, existing)
        setDraftRows(prev => [...prev, { key, value: '' }])
    }

    const updateDraftKey = (i: number, key: string) => {
        setDraftRows(prev => prev.map((r, idx) => idx===i ? {...r, key} : r))
    }
    const updateDraftValue = (i: number, value: string) => {
        setDraftRows(prev => prev.map((r, idx) => idx===i ? {...r, value} : r))
    }
    const removeDraft = (i: number) => {
        setDraftRows(prev => prev.filter((_, idx)=>idx!==i))
    }

    const createFromDrafts = () => {
        const params = { ...committed }
        const used = new Set(Object.keys(params))
        for (const {key, value} of draftRows) {
            const k = makeUniqueKey(key.trim(), used)
            if (!k) continue
            used.add(k)
            params[k] = value
        }
        onChange({ ...(m as any), params } as TestMeta)
        setDraftRows([])
    }

    return (
        <div className="params-panel meta-card">
            {/* TAGS */}
            <section className="params-section">
                <label className="label-sm">Tags</label>
                <TagsEditor value={m.tags ?? []} onChange={setTags} />
            </section>

            {/* BASE FIELDS (status, priority, component) */}
            <section className="params-section">
                <div className="params-head">
                    <label className="label-sm">Base parameters</label>
                </div>
                <div className="params-list">
                    {baseKeys.map(k => {
                        const val = (m as any)[k] ?? ''
                        if (val === undefined || val === null) return null
                        return (
                            <div className="param-row" key={String(k)}>
                                <input
                                    className="input"
                                    value={String(k)}
                                    readOnly
                                    style={{ background:'#fafafa', cursor:'default' }}
                                />
                                <input
                                    className="input"
                                    value={val}
                                    onChange={e=>setBase(k, e.target.value)}
                                    placeholder={String(k)}
                                />
                                <button className="btn-small param-remove" onClick={()=>removeBase(k)}>×</button>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* EXISTING CUSTOM PARAMS */}
            <section className="params-section">
                <div className="params-head"><label className="label-sm">Parameters</label></div>
                {Object.keys(committed).length === 0
                    ? <div className="muted">No parameters yet.</div>
                    : (
                        <div className="params-list">
                            {Object.entries(committed).map(([k, v])=>(
                                <div className="param-row" key={k}>
                                    <input
                                        className="input"
                                        value={k}
                                        onChange={e=>updateExistingKey(k, e.target.value)}
                                        placeholder="Param name"
                                    />
                                    <input
                                        className="input"
                                        value={v}
                                        onChange={e=>updateExistingValue(k, e.target.value)}
                                        placeholder="Value"
                                    />
                                    <button className="btn-small param-remove" onClick={()=>removeExisting(k)}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
            </section>

            {/* ADD NEW PARAMS */}
            <section className="params-section">
                <div className="params-head">
                    <label className="label-sm">Add parameters</label>
                    <button className="btn-small" onClick={addDraft}>+ Add param</button>
                </div>
                {draftRows.length>0 && (
                    <div className="params-list">
                        {draftRows.map((r,i)=>(
                            <div className="param-row" key={`${r.key}-${i}`}>
                                <input
                                    className="input"
                                    value={r.key}
                                    onChange={e=>updateDraftKey(i, e.target.value)}
                                    placeholder="Param name"
                                />
                                <input
                                    className="input"
                                    value={r.value}
                                    onChange={e=>updateDraftValue(i, e.target.value)}
                                    placeholder="Value"
                                />
                                <button className="btn-small param-remove" onClick={()=>removeDraft(i)}>×</button>
                            </div>
                        ))}
                    </div>
                )}
                <div className="params-create-bar">
                    <button className="btn-small" onClick={createFromDrafts} disabled={!draftRows.length}>Create</button>
                </div>
            </section>
        </div>
    )
}

/* helpers */
function makeUniqueKey(base: string, used: Set<string>): string {
    if (!base) return ''
    let key = base
    let i = 1
    while (used.has(key)) key = `${base}${i++}`
    return key
}

/* tag editor */
function TagsEditor({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
    const [draft, setDraft] = React.useState('')
    const add = (t: string) => {
        const tag = t.trim()
        if (!tag) return
        if (value.includes(tag)) return setDraft('')
        onChange([...value, tag]); setDraft('')
    }
    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
        else if (e.key === 'Backspace' && draft==='' && value.length) onChange(value.slice(0,-1))
    }
    const remove = (tag: string) => onChange(value.filter(t=>t!==tag))
    return (
        <div className="tags-box">
            {value.map(t=>(
                <span key={t} className="tag-chip">
          {t}
                    <button className="tag-x" onClick={()=>remove(t)}>×</button>
        </span>
            ))}
            <input
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                onKeyDown={onKey}
                onBlur={()=>add(draft)}
                placeholder="Add tag…"
                className="input tag-input"
            />
        </div>
    )
}
