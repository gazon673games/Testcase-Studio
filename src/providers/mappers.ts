import type { Step, TestCase } from '@core/domain'
import type { ExportStep, ExportTest } from '@core/export'
import type { ProviderTest } from '@providers/types'
import { buildTestDetailsFromProviderTest } from './providerMetadataMapping'
import { copyAttachment, mapDomainStepsToProvider, mapProviderStepsToDomain, type ProviderStepImportOptions } from './providerStepMapping'

export function fromProviderPayload(
    src: ProviderTest,
    previousSteps: Step[] = [],
    options?: ProviderStepImportOptions
): Pick<TestCase, 'name' | 'description' | 'steps' | 'attachments' | 'updatedAt' | 'details' | 'meta'> {
    const details = buildTestDetailsFromProviderTest(src)
    return {
        name: src.name ?? '',
        description: src.description ?? '',
        steps: mapProviderStepsToDomain(src.steps ?? [], previousSteps, options),
        attachments: (src.attachments ?? []).map(copyAttachment),
        updatedAt: src.updatedAt ?? new Date().toISOString(),
        details,
        meta: details,
    }
}

export function toProviderPayload(
    test: Pick<TestCase, 'id' | 'name' | 'description' | 'steps' | 'attachments' | 'details' | 'meta'> | ExportTest
): ProviderTest {
    const id = (test as any).id
    const stepsArray: Array<Step | ExportStep> = (test as any).steps ?? []
    const attachments = (test as any).attachments ?? []

    return {
        id: id ?? String(Math.random()),
        name: test.name,
        description: (test as any).description ?? '',
        steps: mapDomainStepsToProvider(stepsArray),
        attachments: attachments.map(copyAttachment),
        updatedAt: new Date().toISOString(),
    }
}
