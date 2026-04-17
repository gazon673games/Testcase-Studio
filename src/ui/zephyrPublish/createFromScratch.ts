import type { ZephyrPublishPreview, ZephyrPublishPreviewItem } from '@app/sync'

type Translate = (key: string, params?: Record<string, string | number>) => string

export type ZephyrCreateFromScratchCheck = {
    id: 'name' | 'projectKey' | 'steps' | 'stepContent' | 'testType' | 'automation' | 'payload'
    label: string
    detail: string
    passed: boolean
}

export function getCreateFromScratchItem(preview: ZephyrPublishPreview | null | undefined): ZephyrPublishPreviewItem | null {
    if (!preview || preview.items.length !== 1) return null
    const item = preview.items[0]
    const externalId = String(item.externalId ?? item.payload.id ?? '').trim()
    return externalId ? null : item
}

export function buildCreateFromScratchChecks(
    item: ZephyrPublishPreviewItem,
    t: Translate
): ZephyrCreateFromScratchCheck[] {
    const projectKey = String(item.projectKey ?? item.payload.extras?.projectKey ?? '').trim()
    const customFields =
        item.payload.extras?.customFields && typeof item.payload.extras.customFields === 'object'
            ? (item.payload.extras.customFields as Record<string, unknown>)
            : {}
    const testType = normalizeCustomField(customFields['Test Type'])
    const automation = normalizeCustomField(customFields.Automation)
    const steps = Array.isArray(item.payload.steps) ? item.payload.steps : []
    const nonEmptySteps = steps.filter((step) =>
        [step.action, step.data, step.expected].some((value) => String(value ?? '').trim())
    )

    return [
        {
            id: 'name',
            label: t('publish.createCheck.name'),
            detail: String(item.payload.name ?? '').trim() || t('publish.createCheck.missing'),
            passed: Boolean(String(item.payload.name ?? '').trim()),
        },
        {
            id: 'projectKey',
            label: t('publish.createCheck.projectKey'),
            detail: projectKey || t('publish.createCheck.missing'),
            passed: Boolean(projectKey),
        },
        {
            id: 'steps',
            label: t('publish.createCheck.steps'),
            detail: t('publish.createCheck.stepsCount', { count: steps.length }),
            passed: steps.length > 0,
        },
        {
            id: 'stepContent',
            label: t('publish.createCheck.stepContent'),
            detail: t('publish.createCheck.stepsCount', { count: nonEmptySteps.length }),
            passed: nonEmptySteps.length > 0,
        },
        {
            id: 'testType',
            label: t('publish.createCheck.testType'),
            detail: testType || t('publish.createCheck.missing'),
            passed: Boolean(testType),
        },
        {
            id: 'automation',
            label: t('publish.createCheck.automation'),
            detail: automation || t('publish.createCheck.missing'),
            passed: Boolean(automation),
        },
        {
            id: 'payload',
            label: t('publish.createCheck.payload'),
            detail: item.reason,
            passed: item.status === 'create' && item.publish,
        },
    ]
}

export function canCreateFromScratch(item: ZephyrPublishPreviewItem, t: Translate): boolean {
    return buildCreateFromScratchChecks(item, t).every((check) => check.passed)
}

function normalizeCustomField(value: unknown): string {
    return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}
