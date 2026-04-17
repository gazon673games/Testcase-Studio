import { materializeImportedTest } from '@app/sync/zephyrImport/materialize'
import { mkFolder, type ID, type RootState, type Step, type TestCase } from '@core/domain'
import { makeStepRef } from '@core/refs'
import { isZephyrHtmlPartsEnabled, setZephyrHtmlPartsEnabled } from '@core/zephyrHtmlParts'
import { findNode, findParentFolder, insertChild, isFolder, mapTests } from '@core/tree'
import { fromProviderPayload } from '@providers/mappers'
import type { ProviderTest } from '@providers/types'
import { getZephyrStepIntegration, getZephyrTestIntegration, setZephyrStepIntegration } from '@providers/zephyr/zephyrModel'
import { getStoredJsonBeautifyTolerant } from '@shared/uiPreferences'

export type IncludedCaseResolution = 'inline' | 'create-local-case'

export type IncludedCaseCandidate = {
    id: string
    hostTestId: string
    hostTestName: string
    stepId: string
    stepIndex: number
    stepLabel: string
    includedTestKey: string
    includedTestName?: string
    includedStepsCount: number
}

export function collectIncludedCaseCandidates(state: RootState, testIds?: string[]): IncludedCaseCandidate[] {
    const limit = testIds?.length ? new Set(testIds) : null
    const candidates: IncludedCaseCandidate[] = []

    for (const test of mapTests(state.root)) {
        if (limit && !limit.has(test.id)) continue

        for (let index = 0; index < test.steps.length; index += 1) {
            const step = test.steps[index]
            const snapshot = getIncludedTestSnapshot(step)
            const zephyrStep = getZephyrStepIntegration(step)
            const includedTestKey = String(step.source?.includedCaseRef ?? zephyrStep?.includedTest?.key ?? '').trim()
            if (!snapshot || !includedTestKey) continue

            candidates.push({
                id: makeIncludedCaseCandidateId(test.id, step.id),
                hostTestId: test.id,
                hostTestName: test.name,
                stepId: step.id,
                stepIndex: index,
                stepLabel: step.action || step.text || `Step ${index + 1}`,
                includedTestKey,
                includedTestName: String(zephyrStep?.includedTest?.name ?? snapshot.name ?? '').trim() || undefined,
                includedStepsCount: snapshot.steps?.length ?? step.subSteps?.length ?? 0,
            })
        }
    }

    return candidates
}

export function resolveIncludedCaseDecisions(
    state: RootState,
    decisions: Record<string, IncludedCaseResolution>
): {
    nextState: RootState
    dirtyIds: string[]
    createdTestIds: string[]
} {
    const nextState = structuredClone(state)
    const candidates = collectIncludedCaseCandidates(nextState)
    const byTest = new Map<string, IncludedCaseCandidate[]>()

    for (const candidate of candidates) {
        const resolution = decisions[candidate.id]
        if (!resolution) continue
        const queue = byTest.get(candidate.hostTestId)
        if (queue) queue.push(candidate)
        else byTest.set(candidate.hostTestId, [candidate])
    }

    const dirtyIds = new Set<string>()
    const createdTestIds: string[] = []
    const existingByZephyrId = buildExistingByZephyrId(nextState)
    const tolerantJsonBeautify = getStoredJsonBeautifyTolerant()

    for (const [testId, testCandidates] of byTest) {
        const node = findNode(nextState.root, testId)
        if (!node || isFolder(node)) continue

        const hostTest = node
        const parentFolder = findParentFolder(nextState.root, hostTest.id) ?? nextState.root

        for (const candidate of [...testCandidates].sort((left, right) => right.stepIndex - left.stepIndex)) {
            const currentIndex = hostTest.steps.findIndex((step) => step.id === candidate.stepId)
            if (currentIndex < 0) continue

            const currentStep = hostTest.steps[currentIndex]
            const snapshot = getIncludedTestSnapshot(currentStep)
            if (!snapshot) continue

            const resolution = decisions[candidate.id]
            if (resolution === 'inline') {
                const patch = fromProviderPayload(snapshot, [], {
                    parseHtmlParts: isZephyrHtmlPartsEnabled(hostTest),
                    tolerantJsonBeautify,
                })
                hostTest.steps.splice(currentIndex, 1, ...patch.steps.map(stripIncludedMarkers))
                dirtyIds.add(hostTest.id)
                continue
            }

            if (resolution === 'create-local-case') {
                const localTest = ensureLocalIncludedCase(nextState, parentFolder.id, hostTest.name, snapshot, existingByZephyrId, hostTest)
                const linkedSteps = buildReferenceStepsFromLocalCase(localTest)
                hostTest.steps.splice(currentIndex, 1, ...linkedSteps)
                dirtyIds.add(hostTest.id)
                if (!createdTestIds.includes(localTest.id) && !stateHasTest(state, localTest.id)) createdTestIds.push(localTest.id)
            }
        }
    }

    return {
        nextState,
        dirtyIds: [...dirtyIds, ...createdTestIds].filter((value, index, items) => items.indexOf(value) === index),
        createdTestIds,
    }
}

function ensureLocalIncludedCase(
    state: RootState,
    parentFolderId: ID,
    hostTestName: string,
    snapshot: ProviderTest,
    existingByZephyrId: Map<string, TestCase>,
    hostTest: TestCase
) {
    const zephyrId = String(snapshot.id ?? '').trim()
    const existing = zephyrId ? existingByZephyrId.get(zephyrId) : undefined
    if (existing) return existing

    const tolerantJsonBeautify = getStoredJsonBeautifyTolerant()
    const created = materializeImportedTest(snapshot, undefined, { tolerantJsonBeautify })
    if (isZephyrHtmlPartsEnabled(hostTest)) {
        setZephyrHtmlPartsEnabled(created, true)
        const parsed = fromProviderPayload(snapshot, [], {
            parseHtmlParts: true,
            tolerantJsonBeautify,
        })
        created.steps = parsed.steps
        created.integration = parsed.integration
    }

    const includedFolder = ensureIncludedFolder(state, parentFolderId, hostTestName)
    insertChild(state.root, includedFolder.id, created)
    if (zephyrId) existingByZephyrId.set(zephyrId, created)
    return created
}

function ensureIncludedFolder(state: RootState, parentFolderId: ID, hostTestName: string) {
    const parent = findNode(state.root, parentFolderId)
    if (!parent || !isFolder(parent)) return state.root

    const folderName = buildIncludedFolderName(hostTestName)
    const existing = parent.children.find((child) => isFolder(child) && child.name === folderName)
    if (existing && isFolder(existing)) return existing

    const folder = mkFolder(folderName)
    parent.children.push(folder)
    return folder
}

function buildIncludedFolderName(hostTestName: string) {
    const label = String(hostTestName ?? '').trim() || 'Case'
    return `INCLUDED - ${label}`
}

function buildExistingByZephyrId(state: RootState) {
    const map = new Map<string, TestCase>()
    for (const test of mapTests(state.root)) {
        const zephyrId = String(
            test.links.find((link) => link.provider === 'zephyr')?.externalId
            ?? getZephyrTestIntegration(test)?.remote?.key
            ?? ''
        ).trim()
        if (!zephyrId || map.has(zephyrId)) continue
        map.set(zephyrId, test)
    }
    return map
}

function stripIncludedMarkers(step: Step): Step {
    const nextSource = {
        ...(step.source ?? {}),
        includedCaseRef: undefined,
    }
    const nextStep: Step = {
        ...step,
        source: nextSource.sourceStepId ? nextSource : undefined,
        subSteps: step.subSteps ?? [],
    }
    setZephyrStepIntegration(nextStep, undefined)
    return nextStep
}

function buildReferenceStepsFromLocalCase(test: TestCase): Step[] {
    return test.steps.map((step) => {
        const actionValue = String(step.action ?? step.text ?? '').trim()
        const dataValue = String(step.data ?? '').trim()
        const expectedValue = String(step.expected ?? '').trim()

        const actionRef = actionValue ? `[[${makeStepRef('test', test.id, step.id, 'action')}]]` : ''
        const dataRef = dataValue ? `[[${makeStepRef('test', test.id, step.id, 'data')}]]` : ''
        const expectedRef = expectedValue ? `[[${makeStepRef('test', test.id, step.id, 'expected')}]]` : ''

        return {
            id: crypto.randomUUID(),
            action: actionRef,
            data: dataRef,
            expected: expectedRef,
            text: actionRef,
            snapshot: {
                action: actionRef,
                data: dataRef,
                expected: expectedRef,
            },
            subSteps: [],
            presentation: {
                parts: {
                    action: [],
                    data: [],
                    expected: [],
                },
            },
            attachments: [],
        }
    }).map((step) =>
        setZephyrStepIntegration(step, {
            includedTest: { localTestId: test.id },
        })
    )
}

function getIncludedTestSnapshot(step: Step): ProviderTest | null {
    const snapshot = getZephyrStepIntegration(step)?.includedTest?.snapshot
    if (!snapshot || typeof snapshot !== 'object') return null
    const candidate = snapshot as ProviderTest
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !Array.isArray(candidate.steps)) return null
    return candidate
}

function makeIncludedCaseCandidateId(hostTestId: string, stepId: string) {
    return `${hostTestId}\u0000${stepId}`
}

function stateHasTest(state: RootState, testId: string) {
    return mapTests(state.root).some((test) => test.id === testId)
}
