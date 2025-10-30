// ui/testEditor/TestEditor.tsx
import * as React from 'react'
import './TestEditor.css'
import type { TestCase, Step, TestMeta, TestCaseLink, ProviderKind } from '@core/domain'
import { ParamsPanel } from './panels/MetaParamsPanel'
import './panels/MetaParamsPanel.css'
import { AttachmentsPanel } from './panels/AttachmentsPanel'
import './panels/AttachmentsPanel.css'
import DetailsPanel from './panels/DetailsPanel'
import StepsPanel from './panels/StepsPanel'

type Props = {
    test: TestCase
    onChange: (
        patch: Partial<
            Pick<TestCase, 'name' | 'description' | 'steps' | 'meta' | 'attachments' | 'links'>
        >
    ) => void
    focusStepId?: string | null
    allTests: TestCase[]
}

export type TestEditorHandle = { commit(): void }

export const TestEditor = React.forwardRef<TestEditorHandle, Props>(function TestEditor(
    { test, onChange, focusStepId, allTests }: Props,
    ref
) {
    // ───────── локальные только UI-флаги ─────────
    const [showAttachments, setShowAttachments] = React.useState(false)
    const [showDetails, setShowDetails] = React.useState(false)
    const [showMeta, setShowMeta] = React.useState(false)

    // Сброс раскладок при смене теста (не обязательно, но обычно приятнее UX)
    React.useEffect(() => {
        setShowAttachments(false)
        setShowDetails(false)
        setShowMeta(false)
    }, [test.id])

    // ───────── helpers: links ─────────
    const getLink = React.useCallback(
        (provider: ProviderKind) =>
            (test.links ?? []).find((l) => l.provider === provider)?.externalId ?? '',
        [test.links]
    )

    const upsertLink = (provider: ProviderKind, externalId: string) => {
        const trimmed = (externalId ?? '').trim()
        const base = (test.links ?? []).filter((l) => l.provider !== provider)
        const next: TestCaseLink[] = trimmed ? [...base, { provider, externalId: trimmed }] : base
        onChange({ links: next })
    }

    // ───────── wiki-refs для превью ─────────
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
            const refTest = byId.get(testId.trim())
            if (!refTest) return null
            const [stepId, kindRaw] = stepSpecRaw.split('.')
            const st = refTest.steps.find((s) => s.id === stepId?.trim())
            if (!st) return null
            const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action' | 'data' | 'expected'
            const val = (st as any)[kind] ?? st.text ?? ''
            return String(val ?? '')
        }
        const [testName, stepSpec] = body.split('#')
        if (!testName || !stepSpec) return null
        const refTest = byName.get(testName.trim())
        if (!refTest) return null
        const [idxRaw, kindRaw] = stepSpec.split('.')
        const idx = Number(idxRaw)
        if (!Number.isFinite(idx) || idx < 1 || idx > refTest.steps.length) return null
        const st = refTest.steps[idx - 1]
        const kind = (kindRaw ?? 'action').trim().toLowerCase() as 'action' | 'data' | 'expected'
        const val = (st as any)[kind] ?? st.text ?? ''
        return String(val ?? '')
    }

    const resolveRefs = React.useCallback(
        (src: string) => {
            return src.replace(/\[\[([^[\]]+)\]\]/g, (_m, body: string) => {
                const v = resolveOneRef(String(body).trim())
                return v == null ? _m : v
            })
        },
        [byName, byId]
    )

    // Императивный хэндл: все уже контролируется, так что commit — no-op
    React.useImperativeHandle(ref, () => ({ commit: () => {} }), [])

    return (
        <div className="test-editor">
            {/* 🔗 Связи с провайдерами (над названием) */}
            <div className="meta-card" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                <div className="field" style={{ margin: 0 }}>
                    <label className="label-sm">Zephyr key (например PROD-T6079 или номер 6079)</label>
                    <input
                        className="input"
                        value={getLink('zephyr')}
                        onChange={(e) => upsertLink('zephyr', e.target.value)}
                        placeholder="Напр.: PROD-T6079 или 6079"
                    />
                </div>
                <div className="field" style={{ margin: 0 }}>
                    <label className="label-sm">Allure ID</label>
                    <input
                        className="input"
                        value={getLink('allure')}
                        onChange={(e) => upsertLink('allure', e.target.value)}
                        placeholder="Напр.: 12345"
                    />
                </div>
            </div>

            {/* title */}
            <div className="field">
                <label className="label-sm">Name</label>
                <input
                    value={test.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    className="input"
                    placeholder="Enter test name…"
                />
            </div>

            {/* STEPS */}
            <StepsPanel
                steps={test.steps as Step[]}
                onChange={(next) => onChange({ steps: next })}
                allTests={allTests}
                resolveRefs={resolveRefs}
                focusStepId={focusStepId}
                onApply={() => {}} // если обязательный проп, иначе можно убрать
            />

            {/* DETAILS */}
            <SectionHeader
                title="Details"
                open={showDetails}
                onToggle={() => setShowDetails((s) => !s)}
            />
            {showDetails && (
                <DetailsPanel
                    description={test.description ?? ''}
                    onChangeDescription={(v) => onChange({ description: v })}
                    meta={(test.meta as TestMeta) ?? { tags: [] }}
                    onChangeMeta={(m) => onChange({ meta: m })}
                    allTests={allTests}
                    resolveRefs={resolveRefs}
                />
            )}

            {/* ATTACHMENTS */}
            <SectionHeader
                title="Attachments"
                open={showAttachments}
                count={(test.attachments?.length ?? 0)}
                onToggle={() => setShowAttachments((s) => !s)}
            />
            {showAttachments && (
                <AttachmentsPanel
                    attachments={test.attachments ?? []}
                    onChange={(next) => onChange({ attachments: next })}
                />
            )}

            {/* PARAMETERS */}
            <SectionHeader
                title="Parameters"
                open={showMeta}
                onToggle={() => setShowMeta((s) => !s)}
            />
            {showMeta && (
                <ParamsPanel
                    meta={(test.meta as TestMeta) ?? { tags: [] }}
                    onChange={(m) => onChange({ meta: m })}
                />
            )}
        </div>
    )
})

const SectionHeader = ({
                           title,
                           open,
                           count,
                           onToggle,
                           right,
                       }: {
    title: string
    open: boolean
    count?: number
    onToggle(): void
    right?: React.ReactNode
}) => (
    <div className="section-header" data-spoiler data-nopress>
        <button type="button" onClick={onToggle}>
            <span style={{ width: 14, textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
            <span>
        {title}
                {typeof count === 'number' ? ` (${count})` : ''}
      </span>
        </button>
        <span className="spacer" />
        {right}
    </div>
)
