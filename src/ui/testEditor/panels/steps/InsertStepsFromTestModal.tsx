import * as React from 'react'
import type { TestCase } from '@core/domain'
import { canReferenceTestStep } from '@core/referenceSteps'
import {
    looksLikeHtml,
    mdToHtml,
    normalizeImageWikiRefs,
    sanitizeHtml,
} from '../../markdownEditor/previewRendering'
import {
    PreviewButton,
    PreviewCard,
    PreviewDialog,
    PreviewDialogSplit,
    PreviewField,
    PreviewHint,
    PreviewInfoGrid,
    PreviewInfoPair,
    PreviewToolbar,
    PreviewToolbarGroup,
} from '../../../previewDialog'
import { useUiPreferences } from '../../../preferences'
import './InsertStepsFromTestModal.css'

type Props = {
    open: boolean
    ownerTestId: string
    allTests: TestCase[]
    resolveRefs(src: string): string
    onClose(): void
    onApply(testId: string, stepIds: string[]): void
}

export function InsertStepsFromTestModal({ open, ownerTestId, allTests, resolveRefs, onClose, onApply }: Props) {
    const { t } = useUiPreferences()
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [query, setQuery] = React.useState('')
    const [selectedTestId, setSelectedTestId] = React.useState<string | null>(null)
    const [selectedStepIds, setSelectedStepIds] = React.useState<string[]>([])

    const availableTests = React.useMemo(
        () => allTests
            .filter((test) => test.id !== ownerTestId)
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
        [allTests, ownerTestId]
    )

    const filteredTests = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return availableTests

        return availableTests.filter((test) => {
            const zephyrId = String(test.links.find((link) => link.provider === 'zephyr')?.externalId ?? '').toLowerCase()
            return test.name.toLowerCase().includes(needle) || zephyrId.includes(needle)
        })
    }, [availableTests, query])

    const selectedTest = React.useMemo(() => {
        const preferred = filteredTests.find((test) => test.id === selectedTestId)
        if (preferred) return preferred
        const fallback = availableTests.find((test) => test.id === selectedTestId)
        if (fallback && !query.trim()) return fallback
        return filteredTests[0] ?? null
    }, [availableTests, filteredTests, query, selectedTestId])

    const selectableSteps = React.useMemo(
        () => selectedTest?.steps.filter(canReferenceTestStep) ?? [],
        [selectedTest]
    )

    React.useEffect(() => {
        if (!open) return
        setQuery('')
        setSelectedStepIds([])
        setSelectedTestId(availableTests[0]?.id ?? null)
    }, [availableTests, open])

    React.useEffect(() => {
        if (!open) return
        if (selectedTest && selectedTest.id !== selectedTestId) {
            setSelectedTestId(selectedTest.id)
            setSelectedStepIds([])
        }
    }, [open, selectedTest, selectedTestId])

    const selectedCount = React.useMemo(
        () => selectableSteps.filter((step) => selectedStepIds.includes(step.id)).length,
        [selectableSteps, selectedStepIds]
    )

    const canApply = Boolean(selectedTest && selectedCount > 0)

    if (!open) return null

    return (
        <PreviewDialog
            open={open}
            title={t('steps.insertFromTestTitle')}
            subtitle={t('steps.insertFromTestSubtitle')}
            onClose={onClose}
            initialFocusRef={searchInputRef}
        >
            <PreviewDialogSplit
                sidebar={(
                    <div className="insert-steps-modal">
                        <PreviewField label={t('steps.insertFromTestSearch')}>
                            <input
                                ref={searchInputRef}
                                className="preview-dialog__input"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('steps.insertFromTestSearchPlaceholder')}
                            />
                        </PreviewField>
                        {filteredTests.length === 0 ? (
                            <PreviewCard>
                                <PreviewHint>
                                    {availableTests.length === 0
                                        ? t('steps.insertFromTestNoTests')
                                        : t('steps.insertFromTestNoMatches')}
                                </PreviewHint>
                            </PreviewCard>
                        ) : (
                            <div className="insert-steps-modal__test-list">
                                {filteredTests.map((test) => {
                                    const zephyrId = String(test.links.find((link) => link.provider === 'zephyr')?.externalId ?? '').trim()
                                    return (
                                        <button
                                            key={test.id}
                                            type="button"
                                            className={`insert-steps-modal__test-item${selectedTest?.id === test.id ? ' active' : ''}`}
                                            onClick={() => {
                                                setSelectedTestId(test.id)
                                                setSelectedStepIds([])
                                            }}
                                        >
                                            <div className="insert-steps-modal__test-name">{test.name}</div>
                                            <div className="insert-steps-modal__test-meta">
                                                <span>{t('steps.insertFromTestStepsCount', { count: test.steps.length })}</span>
                                                {zephyrId ? <span>{zephyrId}</span> : null}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
                content={selectedTest ? (
                    <div className="insert-steps-modal">
                        <PreviewCard>
                            <PreviewInfoGrid>
                                <PreviewInfoPair label={t('steps.insertFromTestSource')} value={selectedTest.name} />
                                <PreviewInfoPair label={t('steps.insertFromTestSteps')} value={String(selectableSteps.length)} />
                                <PreviewInfoPair label={t('steps.insertFromTestSelected')} value={String(selectedCount)} />
                            </PreviewInfoGrid>
                        </PreviewCard>

                        {selectableSteps.length === 0 ? (
                            <PreviewCard>
                                <PreviewHint>{t('steps.insertFromTestNoReferenceableSteps')}</PreviewHint>
                            </PreviewCard>
                        ) : (
                            <>
                                <PreviewToolbar>
                                    <PreviewToolbarGroup>
                                        <PreviewHint>{t('steps.insertFromTestChooseHint')}</PreviewHint>
                                    </PreviewToolbarGroup>
                                    <PreviewToolbarGroup align="end">
                                        <PreviewButton
                                            tone="ghost"
                                            onClick={() => setSelectedStepIds(selectableSteps.map((step) => step.id))}
                                        >
                                            {t('steps.insertFromTestSelectAll')}
                                        </PreviewButton>
                                        <PreviewButton tone="ghost" onClick={() => setSelectedStepIds([])}>
                                            {t('steps.insertFromTestClear')}
                                        </PreviewButton>
                                    </PreviewToolbarGroup>
                                </PreviewToolbar>

                                <div className="insert-steps-modal__step-list">
                                    {selectableSteps.map((step, index) => {
                                        const checked = selectedStepIds.includes(step.id)
                                        return (
                                            <label key={step.id} className="insert-steps-modal__step-item">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => {
                                                        setSelectedStepIds((current) => (
                                                            event.target.checked
                                                                ? [...current, step.id]
                                                                : current.filter((value) => value !== step.id)
                                                        ))
                                                    }}
                                                />
                                                <div className="insert-steps-modal__step-copy">
                                                    <div className="insert-steps-modal__step-title">
                                                        {t('steps.stepNumber', { index: index + 1 })}
                                                    </div>
                                                    <div className="insert-steps-modal__step-grid">
                                                        <PreviewBlock
                                                            label={t('steps.action')}
                                                            value={step.action || step.text || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                        <PreviewBlock
                                                            label={t('steps.data')}
                                                            value={step.data || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                        <PreviewBlock
                                                            label={t('steps.expected')}
                                                            value={step.expected || ''}
                                                            emptyLabel={t('publish.summary.empty')}
                                                            resolveRefs={resolveRefs}
                                                        />
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        <div className="insert-steps-modal__actions">
                            <PreviewButton tone="ghost" onClick={onClose}>
                                {t('includedCases.close')}
                            </PreviewButton>
                            <PreviewButton
                                onClick={() => {
                                    if (!selectedTest) return
                                    onApply(selectedTest.id, selectedStepIds)
                                }}
                                disabled={!canApply}
                            >
                                {t('steps.insertFromTestApply')}
                            </PreviewButton>
                        </div>
                    </div>
                ) : (
                    <div className="insert-steps-modal">
                        <PreviewCard>
                            <PreviewHint>{t('steps.insertFromTestSelectSource')}</PreviewHint>
                        </PreviewCard>
                    </div>
                )}
                className="preview-dialog__split--compact"
            />
        </PreviewDialog>
    )
}

function PreviewBlock({
    label,
    value,
    emptyLabel,
    resolveRefs,
}: {
    label: string
    value: string
    emptyLabel: string
    resolveRefs(src: string): string
}) {
    const html = React.useMemo(() => renderPreviewHtml(value, resolveRefs), [resolveRefs, value])
    const isEmpty = !String(value ?? '').trim()

    return (
        <div className="insert-steps-modal__field">
            <div className="insert-steps-modal__field-label">{label}</div>
            {isEmpty ? (
                <div className="insert-steps-modal__field-empty">{emptyLabel}</div>
            ) : (
                <div
                    className="insert-steps-modal__field-preview"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}
        </div>
    )
}

function renderPreviewHtml(input: string, resolveRefs: (src: string) => string) {
    const resolved = resolveRefs(input ?? '')
    const html = looksLikeHtml(resolved)
        ? sanitizeHtml(resolved)
        : mdToHtml(normalizeImageWikiRefs(resolved, resolveRefs))

    return normalizeModalPreviewHtml(html)
}

function normalizeModalPreviewHtml(html: string) {
    if (typeof document === 'undefined') return html

    const container = document.createElement('div')
    container.innerHTML = html
    removeZephyrSpacerWrappers(container)
    trimTextNodeEdges(container)
    trimContainerEdges(container)
    return container.innerHTML
}

function trimContainerEdges(container: HTMLElement) {
    let changed = true

    while (changed) {
        changed = false

        const first = container.firstChild
        if (first && isIgnorableEdgeNode(first, 'start')) {
            container.removeChild(first)
            changed = true
            continue
        }

        const last = container.lastChild
        if (last && isIgnorableEdgeNode(last, 'end')) {
            container.removeChild(last)
            changed = true
        }
    }
}

function isIgnorableEdgeNode(node: ChildNode, edge: 'start' | 'end'): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
        return !String(node.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return false

    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (tag === 'br') return true

    trimContainerEdges(element)

    if (isEmptyEdgeElement(element)) return true

    if ((tag === 'div' || tag === 'p') && edge === 'start') {
        const first = element.firstChild
        return first != null && isIgnorableEdgeNode(first as ChildNode, edge) && !String(element.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    if ((tag === 'div' || tag === 'p') && edge === 'end') {
        const last = element.lastChild
        return last != null && isIgnorableEdgeNode(last as ChildNode, edge) && !String(element.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    }

    return false
}

function isEmptyEdgeElement(element: HTMLElement): boolean {
    if (element.querySelector('img, video, audio, iframe, table')) return false

    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('br').forEach((item) => item.remove())
    return !String(clone.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function removeZephyrSpacerWrappers(container: HTMLElement) {
    for (const element of Array.from(container.querySelectorAll('em, span, div, p'))) {
        if (!isEmptyElementWithOnlyBreaks(element as HTMLElement)) continue
        element.remove()
    }
}

function isEmptyElementWithOnlyBreaks(element: HTMLElement): boolean {
    if (element.querySelector('img, video, audio, iframe, table, ol, ul, li, pre')) return false
    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('br').forEach((item) => item.remove())
    return !String(clone.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function trimTextNodeEdges(container: HTMLElement) {
    for (const node of Array.from(container.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const normalized = String(node.textContent ?? '')
                .replace(/\u00a0/g, ' ')
                .replace(/^[ \t\r\n]+/, '')
                .replace(/[ \t\r\n]+$/, '')
            node.textContent = normalized
            continue
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            trimTextNodeEdges(node as HTMLElement)
        }
    }
}
