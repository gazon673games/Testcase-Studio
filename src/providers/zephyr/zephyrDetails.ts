import type { ProviderStep, ProviderTest } from '../types'
import type { ZephyrTestCaseResponse } from './zephyrResponses'
import { normalizeRemoteAttachments } from './zephyrValueMapping'

export function mapZephyrTestDetails(json: ZephyrTestCaseResponse, fallbackRef: string): ProviderTest {
    const resolvedRef = json.key || fallbackRef

    return {
        id: resolvedRef,
        name: String(json.name ?? resolvedRef),
        description: json.description ?? undefined,
        steps: mapZephyrSteps(json),
        attachments: normalizeRemoteAttachments(json.attachments, resolvedRef),
        updatedAt: json.updatedOn ?? new Date().toISOString(),
        extras: buildZephyrExtras(json),
    }
}

function mapZephyrSteps(json: ZephyrTestCaseResponse): ProviderStep[] {
    return (json.testScript?.steps ?? [])
        .filter((step) => step && (step.description || step.testData || step.expectedResult))
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
        .map((step, index) => ({
            action: String(step.description ?? ''),
            data: String(step.testData ?? ''),
            expected: String(step.expectedResult ?? ''),
            text: String(step.description ?? ''),
            providerStepId: String(step.id ?? `index:${step.index ?? index + 1}`),
            attachments: normalizeRemoteAttachments(step.attachments, `step:${step.id ?? index + 1}`),
        }))
}

function buildZephyrExtras(json: ZephyrTestCaseResponse): Record<string, unknown> {
    return {
        key: json.key,
        keyNumber: json.keyNumber,
        status: json.status,
        priority: json.priority,
        component: json.component,
        projectKey: json.projectKey,
        folder: json.folder,
        latestVersion: json.latestVersion,
        lastTestResultStatus: json.lastTestResultStatus,
        owner: json.owner,
        updatedBy: json.updatedBy,
        createdBy: json.createdBy,
        createdOn: json.createdOn,
        updatedOn: json.updatedOn,
        issueLinks: json.issueLinks ?? [],
        customFields: json.customFields ?? {},
        parameters: json.parameters ?? { variables: [], entries: [] },
        objective: json.objective ?? null,
        preconditions: json.precondition ?? null,
        labels: json.labels ?? [],
    }
}
