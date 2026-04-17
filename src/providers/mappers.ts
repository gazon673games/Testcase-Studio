import type { Step, TestCase } from '@core/domain'
import type { ExportStep, ExportTest } from '@core/export'
import type { ProviderTest } from '@providers/types'
import { projectProviderTestMetadata } from './providerMetadataMapping'
import { copyAttachment, mapDomainStepsToProvider, mapProviderStepsToDomain, type ProviderStepImportOptions } from './providerStepMapping'
import { setZephyrTestIntegration } from '@providers/zephyr/zephyrModel'

export function fromProviderPayload(
    src: ProviderTest,
    previousSteps: Step[] = [],
    options?: ProviderStepImportOptions
): Pick<TestCase, 'name' | 'description' | 'steps' | 'attachments' | 'updatedAt' | 'details' | 'integration'> {
    const projection = projectProviderTestMetadata(src)
    const integrationHolder = setZephyrTestIntegration({} as TestCase, projection.integration)
    return {
        name: src.name ?? '',
        description: src.description ?? '',
        steps: mapProviderStepsToDomain(src.steps ?? [], previousSteps, options),
        attachments: (src.attachments ?? []).map(copyAttachment),
        updatedAt: src.updatedAt ?? new Date().toISOString(),
        details: projection.details,
        integration: integrationHolder.integration,
    }
}

export function toProviderPayload(
    test: Pick<TestCase, 'id' | 'name' | 'description' | 'steps' | 'attachments' | 'details' | 'integration'> | ExportTest
): ProviderTest {
    const stepsArray: Array<Step | ExportStep> = test.steps ?? []

    return {
        id: test.id ?? String(Math.random()),
        name: test.name,
        description: test.description ?? '',
        steps: mapDomainStepsToProvider(stepsArray),
        attachments: (test.attachments ?? []).map(copyAttachment),
        updatedAt: new Date().toISOString(),
    }
}
