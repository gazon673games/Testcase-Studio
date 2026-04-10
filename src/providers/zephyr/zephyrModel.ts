import type { Step, TestCase } from '@core/domain'
import type { ProviderTest } from '@providers/types'

const ZEPHYR_INTEGRATION_KEY = 'zephyr'

export interface ZephyrPublicationConfig {
    type?: string
    automation?: string
    assignedTo?: string
}

export interface ZephyrParameterCatalog {
    variables?: unknown[]
    entries?: unknown[]
}

export interface ZephyrRemoteTestRecord {
    key?: string
    keyNumber?: string
    projectKey?: string
    latestVersion?: boolean
    lastTestResultStatus?: string
    updatedBy?: string
    createdBy?: string
    createdOn?: string
    updatedOn?: string
    issueLinks?: string[]
    customFields?: Record<string, unknown>
    parameters?: ZephyrParameterCatalog
}

export interface ZephyrImportState {
    signature?: string
    managedAttributeKeys?: string[]
    remoteKey?: string
    remoteUpdatedAt?: string
    importedAt?: string
    conflictRemoteKey?: string
    conflictLocalId?: string
}

export interface ZephyrPublishState {
    signature?: string
    remoteKey?: string
    publishedAt?: string
}

export interface ZephyrImportOptions {
    parseHtmlParts?: boolean
}

export interface ZephyrTestIntegration {
    publication?: ZephyrPublicationConfig
    remote?: ZephyrRemoteTestRecord
    importState?: ZephyrImportState
    publishState?: ZephyrPublishState
    options?: ZephyrImportOptions
}

export interface ZephyrIncludedTestState {
    key?: string
    name?: string
    snapshot?: ProviderTest
    localTestId?: string
}

export interface ZephyrStepIntegration {
    includedTest?: ZephyrIncludedTestState
}

function cloneIntegrationBag(source: Record<string, unknown> | undefined) {
    return source ? { ...source } : {}
}

export function getZephyrTestIntegration(test: Pick<TestCase, 'integration'> | undefined): ZephyrTestIntegration | undefined {
    const value = test?.integration?.[ZEPHYR_INTEGRATION_KEY]
    return value && typeof value === 'object' ? (value as ZephyrTestIntegration) : undefined
}

export function setZephyrTestIntegration(test: TestCase, integration: ZephyrTestIntegration | undefined): TestCase {
    const next = cloneIntegrationBag(test.integration)
    if (integration && hasMeaningfulValues(integration)) next[ZEPHYR_INTEGRATION_KEY] = integration
    else delete next[ZEPHYR_INTEGRATION_KEY]
    test.integration = Object.keys(next).length ? next : undefined
    return test
}

export function updateZephyrTestIntegration(
    test: TestCase,
    update: (current: ZephyrTestIntegration | undefined) => ZephyrTestIntegration | undefined
): TestCase {
    return setZephyrTestIntegration(test, update(getZephyrTestIntegration(test)))
}

export function getZephyrStepIntegration(step: Pick<Step, 'integration'> | undefined): ZephyrStepIntegration | undefined {
    const value = step?.integration?.[ZEPHYR_INTEGRATION_KEY]
    return value && typeof value === 'object' ? (value as ZephyrStepIntegration) : undefined
}

export function setZephyrStepIntegration(step: Step, integration: ZephyrStepIntegration | undefined): Step {
    const next = cloneIntegrationBag(step.integration)
    if (integration && hasMeaningfulValues(integration)) next[ZEPHYR_INTEGRATION_KEY] = integration
    else delete next[ZEPHYR_INTEGRATION_KEY]
    step.integration = Object.keys(next).length ? next : undefined
    return step
}

export function updateZephyrStepIntegration(
    step: Step,
    update: (current: ZephyrStepIntegration | undefined) => ZephyrStepIntegration | undefined
): Step {
    return setZephyrStepIntegration(step, update(getZephyrStepIntegration(step)))
}

function hasMeaningfulValues(value: unknown): boolean {
    if (value == null) return false
    if (Array.isArray(value)) return value.some((item) => hasMeaningfulValues(item))
    if (typeof value !== 'object') return true
    return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulValues(item))
}
