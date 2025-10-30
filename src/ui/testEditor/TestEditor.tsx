import * as React from 'react'
import './TestEditor.css'
import type { TestCase, Step, TestMeta } from '@core/domain'
import { ParamsPanel } from './panels/MetaParamsPanel'
import './panels/MetaParamsPanel.css'
import { AttachmentsPanel } from './panels/AttachmentsPanel'
import './panels/AttachmentsPanel.css'
import DetailsPanel from './panels/DetailsPanel'
import StepsPanel from './panels/StepsPanel'

type Props = {
    test: TestCase
    onChange: (
        patch: Partial<Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments'>>
    ) => void
    focusStepId?: string | null
    allTests: TestCase[]
}

export type TestEditorHandle = { commit(): void }

export const TestEditor = React.forwardRef<TestEditorHandle, Props>(function TestEditor(
    { test, onChange, focusStepId, allTests }: Props,
    ref
) {
    const [name, setName] = React.useState(test.name)
    const [desc, setDesc] = React.useState(test.description ?? '')
    const [steps, setSteps] = React.useState<Step[]>(test.steps)
    const [meta, setMeta] = React.useState<TestMeta>(test.meta ?? { tags: [] })

    // секции
    const [showAttachments, setShowAttachments] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [showMeta, setShowMeta] = React.useState(false)

    React.useEffect(() => {
        setName(test.name)
        setDesc(test.description ?? '')
        setSteps(test.steps)
        setMeta(test.meta ?? { tags: [] })
        setShowAttachments(false)
        setShowDetails(false)
        setShowMeta(false)
    }, [test.id])

    function savePatch() { onChange({ name, description: desc, steps, meta }) }
    React.useImperativeHandle(ref, () => ({ commit: savePatch }), [name, desc, steps, meta])

    /* ───────── wiki-refs для превью ───────── */
    const byName = React.useMemo(() => {
        const m = new Map<string, TestCase>()
        for (const t of allTests) m.set(t.name, t)
        return m
    }, [allTests])
    const byId = React.useMemo(() => {
        const m = new Map<string, TestCase>()
        for (const t of allTests) m.set(t.id, t)
        return m
    }, [allTests])

    function resolveOneRef(body: string): string | null {
        if (body.startsWith('id:')) {
            const rest = body.slice(3)
            const [testId, stepSpecRaw] = rest.split('#')
            if (!testId || !stepSpecRaw) return null
            const test = byId.get(testId.trim())
            if (!test) return null
            const [stepId, kindRaw] = stepSpecRaw.split('.')
            const st = test.steps.find(s => s.id === stepId?.trim())
            if (!st) return null
            const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action'|'data'|'expected'
            const val = (st as any)[kind] ?? st.text ?? ''
            return String(val ?? '')
        }
        const [testName, stepSpec] = body.split('#')
        if (!testName || !stepSpec) return null
        const test = byName.get(testName.trim())
        if (!test) return null
        const [idxRaw, kindRaw] = stepSpec.split('.')
        const idx = Number(idxRaw)
        if (!Number.isFinite(idx) || idx < 1 || idx > test.steps.length) return null
        const st = test.steps[idx - 1]
        const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action'|'data'|'expected'
        const val = (st as any)[kind] ?? st.text ?? ''
        return String(val ?? '')
    }

    const resolveRefs = React.useCallback((src: string) => {
        return src.replace(/\[\[([^[\]]+)\]\]/g, (_m, body: string) => {
            const v = resolveOneRef(String(body).trim())
            return v == null ? _m : v
        })
    }, [byName, byId])

    return (
        <div className="test-editor">
            {/* title */}
            <div className="field">
                <label className="label-sm">Name</label>
                <input
                    value={name}
                    onChange={e=>setName(e.target.value)}
                    onBlur={savePatch}
                    className="input"
                    placeholder="Enter test name…"
                />
            </div>

            {/* STEPS */}
            <StepsPanel
                steps={steps}
                onChange={(next)=>{ setSteps(next); onChange({ steps: next }) }}
                allTests={allTests}
                resolveRefs={resolveRefs}
                focusStepId={focusStepId}
                onApply={savePatch}
            />

            {/* DETAILS */}
            <SectionHeader title="Details" open={showDetails} onToggle={() => setShowDetails(s=>!s)} />
            {showDetails && (
                <DetailsPanel
                    description={desc}
                    onChangeDescription={(v)=>{ setDesc(v); onChange({ description: v }) }}
                    meta={meta}
                    onChangeMeta={(m)=>{ setMeta(m); onChange({ meta: m }) }}
                    allTests={allTests}
                    resolveRefs={resolveRefs}
                />
            )}

            {/* ATTACHMENTS */}
            <SectionHeader
                title="Attachments"
                open={showAttachments}
                count={test.attachments.length}
                onToggle={() => setShowAttachments(s => !s)}
            />
            {showAttachments && (
                <AttachmentsPanel
                    attachments={test.attachments}
                    onChange={(next) => onChange({ attachments: next })}
                    /* onUploadFiles можно не передавать — панель сама прочитает файлы в dataURL.
                       Если появится бэкенд/файловая система — просто пробрось колбэк сюда. */
                />
            )}

            {/* PARAMETERS */}
            <SectionHeader title="Parameters" open={showMeta} onToggle={() => setShowMeta(s=>!s)} />
            {showMeta && (
                <ParamsPanel
                    meta={meta}
                    onChange={(m) => { setMeta(m); onChange({ meta: m }) }}
                />
            )}
        </div>
    )
})

/* ────────────────────────────────────────────────────────────────────────── */

const SectionHeader = (
    { title, open, count, onToggle, right }:
        { title: string; open: boolean; count?: number; onToggle(): void; right?: React.ReactNode }
) => (
    <div className="section-header" data-spoiler data-nopress>
        <button type="button" onClick={onToggle}>
            <span style={{ width:14, textAlign:'center' }}>{open ? '▾' : '▸'}</span>
            <span>{title}{typeof count === 'number' ? ` (${count})` : ''}</span>
        </button>
        <span className="spacer" />
        {right}
    </div>
)
