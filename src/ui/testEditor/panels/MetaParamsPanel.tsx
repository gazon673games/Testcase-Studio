import * as React from 'react'
import type { TestMeta } from '@core/domain'
import './MetaParamsPanel.css'
import { useUiPreferences } from '../../preferences'

type Props = { meta: TestMeta; onChange(meta: TestMeta): void }
type DraftRow = { key: string; value: string }

const LEGACY_KEYS: Array<keyof TestMeta> = ['status', 'priority', 'component']

export function ParamsPanel({ meta, onChange }: Props) {
    const { t } = useUiPreferences()
    const current = meta ?? { tags: [] }
    const committed: Record<string, any> = current.attributes ?? {}
    const didMigrateRef = React.useRef(false)
    const [draftRows, setDraftRows] = React.useState<DraftRow[]>([])

    React.useEffect(() => {
        if (didMigrateRef.current) return
        let changed = false
        const nextParams: Record<string, string> = { ...committed }
        const nextMeta: any = { ...current }

        for (const key of LEGACY_KEYS) {
            const value = (current as any)[key]
            if (value !== undefined && value !== null && value !== '') {
                if (nextParams[String(key)] === undefined) nextParams[String(key)] = String(value)
                delete nextMeta[key]
                changed = true
            }
        }

        if (changed) {
            nextMeta.attributes = nextParams
            onChange(nextMeta as TestMeta)
        }
        didMigrateRef.current = true
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function setTags(tags: string[]) {
        onChange({ ...(current as any), tags } as TestMeta)
    }

    function updateExistingKey(oldKey: string, newKey: string) {
        const params = { ...committed }
        const value = params[oldKey]
        delete params[oldKey]
        const key = makeUniqueKey(newKey.trim(), new Set(Object.keys(params)))
        params[key] = value
        onChange({ ...(current as any), attributes: params } as TestMeta)
    }

    function updateExistingValue(key: string, value: string) {
        const params = { ...committed, [key]: value }
        onChange({ ...(current as any), attributes: params } as TestMeta)
    }

    function removeExisting(key: string) {
        const params = { ...committed }
        delete params[key]
        onChange({ ...(current as any), attributes: params } as TestMeta)
    }

    function addDraft() {
        const existing = new Set([...Object.keys(committed), ...draftRows.map((row) => row.key)])
        const key = makeUniqueKey('param', existing)
        setDraftRows((rows) => [...rows, { key, value: '' }])
    }

    function updateDraftKey(index: number, key: string) {
        setDraftRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, key } : row)))
    }

    function updateDraftValue(index: number, value: string) {
        setDraftRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, value } : row)))
    }

    function removeDraft(index: number) {
        setDraftRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
    }

    function createFromDrafts() {
        const params = { ...committed }
        const used = new Set(Object.keys(params))
        for (const { key, value } of draftRows) {
            const normalizedKey = makeUniqueKey(key.trim(), used)
            if (!normalizedKey) continue
            used.add(normalizedKey)
            params[normalizedKey] = value
        }
        onChange({ ...(current as any), attributes: params } as TestMeta)
        setDraftRows([])
    }

    return (
        <div className="params-panel meta-card">
            <section className="params-section">
                <label className="label-sm">{t('params.tags')}</label>
                <TagsEditor value={current.tags ?? []} onChange={setTags} />
            </section>

            <section className="params-section">
                <div className="params-head">
                    <label className="label-sm">{t('params.parameters')}</label>
                </div>
                {Object.keys(committed).length === 0 ? (
                    <div className="muted">{t('params.noParameters')}</div>
                ) : (
                    <div className="params-list">
                        {Object.entries(committed).map(([key, value]) => (
                            <div className="param-row" key={key}>
                                <input
                                    className="input"
                                    value={key}
                                    onChange={(event) => updateExistingKey(key, event.target.value)}
                                    placeholder={t('params.paramNamePlaceholder')}
                                />
                                <input
                                    className="input"
                                    value={String(value ?? '')}
                                    onChange={(event) => updateExistingValue(key, event.target.value)}
                                    placeholder={t('params.paramValuePlaceholder')}
                                />
                                <button type="button" className="btn-small param-remove" onClick={() => removeExisting(key)}>
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="params-section">
                <div className="params-head">
                    <label className="label-sm">{t('params.addParameters')}</label>
                    <button type="button" className="btn-small" onClick={addDraft}>
                        {t('params.addParam')}
                    </button>
                </div>
                {draftRows.length > 0 ? (
                    <div className="params-list">
                        {draftRows.map((row, index) => (
                            <div className="param-row" key={`${row.key}-${index}`}>
                                <input
                                    className="input"
                                    value={row.key}
                                    onChange={(event) => updateDraftKey(index, event.target.value)}
                                    placeholder={t('params.paramNamePlaceholder')}
                                />
                                <input
                                    className="input"
                                    value={row.value}
                                    onChange={(event) => updateDraftValue(index, event.target.value)}
                                    placeholder={t('params.paramValuePlaceholder')}
                                />
                                <button type="button" className="btn-small param-remove" onClick={() => removeDraft(index)}>
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}
                <div className="params-create-bar">
                    <button type="button" className="btn-small" onClick={createFromDrafts} disabled={!draftRows.length}>
                        {t('params.create')}
                    </button>
                </div>
            </section>
        </div>
    )
}

function makeUniqueKey(base: string, used: Set<string>): string {
    if (!base) return ''
    let key = base
    let index = 1
    while (used.has(key)) key = `${base}${index++}`
    return key
}

function TagsEditor({ value, onChange }: { value: string[]; onChange(next: string[]): void }) {
    const { t } = useUiPreferences()
    const [draft, setDraft] = React.useState('')

    function addTag(raw: string) {
        const tag = raw.trim()
        if (!tag) return
        if (value.includes(tag)) {
            setDraft('')
            return
        }
        onChange([...value, tag])
        setDraft('')
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            addTag(draft)
            return
        }
        if (event.key === 'Backspace' && draft === '' && value.length) {
            onChange(value.slice(0, -1))
        }
    }

    function removeTag(tag: string) {
        onChange(value.filter((item) => item !== tag))
    }

    return (
        <div className="tags-box">
            {value.map((tag) => (
                <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" className="tag-x" onClick={() => removeTag(tag)}>
                        x
                    </button>
                </span>
            ))}
            <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => addTag(draft)}
                placeholder={t('params.addTagPlaceholder')}
                className="input tag-input"
            />
        </div>
    )
}

export default ParamsPanel
