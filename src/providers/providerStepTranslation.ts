import { v4 as uuid } from 'uuid'
import type { Attachment, Step } from '@core/domain'
import type { ExportStep } from '@core/export'
import type { ProviderStep } from '@providers/types'
import { attachIncludedTestSnapshot, buildNestedSubSteps } from './providerIncludedTests'
import { applyProviderStepImportPolicies } from './providerStepImportPolicies'
import { buildImportedStepInternal, createPreviousStepMatcher } from './providerStepMerge'

export type ProviderStepImportPolicy = {
    parseHtmlParts?: boolean
    tolerantJsonBeautify?: boolean
}

export function cloneAttachment(attachment: Attachment): Attachment {
    return { id: attachment.id, name: attachment.name, pathOrDataUrl: attachment.pathOrDataUrl }
}

export function importProviderSteps(
    sourceSteps: ProviderStep[],
    previousSteps: Step[] = [],
    policy?: ProviderStepImportPolicy
): Step[] {
    const previousMatcher = createPreviousStepMatcher(previousSteps)

    return (sourceSteps ?? []).map((providerStep, index) => {
        const preservedStep = previousMatcher.match(providerStep, index)
        const sourceStepId = safeStr(providerStep.providerStepId).trim() || preservedStep?.source?.sourceStepId
        const includedCaseRef = safeStr(providerStep.testCaseKey).trim() || undefined
        const nestedSubSteps = buildNestedSubSteps(providerStep.includedTest)

        const snapshot = {
            action: safeStr(providerStep.action),
            data: safeStr(providerStep.data),
            expected: safeStr(providerStep.expected),
        }
        const presentation = buildImportedStepInternal(preservedStep, policy?.parseHtmlParts)

        const domainStep: Step = {
            id: preservedStep?.id ?? uuid(),
            action: snapshot.action,
            data: snapshot.data,
            expected: snapshot.expected,
            text: safeStr(providerStep.text ?? providerStep.action),
            snapshot,
            raw: snapshot,
            source: {
                ...(sourceStepId ? { sourceStepId } : {}),
                ...(includedCaseRef ? { includedCaseRef } : {}),
            },
            subSteps: nestedSubSteps.length ? nestedSubSteps : (includedCaseRef ? [] : preservedStep?.subSteps ?? []),
            presentation,
            internal: presentation,
            usesShared: preservedStep?.usesShared,
            attachments: (providerStep.attachments?.length ? providerStep.attachments : preservedStep?.attachments ?? []).map(cloneAttachment),
        }

        attachIncludedTestSnapshot(domainStep, providerStep, includedCaseRef)

        return applyProviderStepImportPolicies(domainStep, policy)
    })
}

export function exportProviderSteps(sourceSteps: Array<Step | ExportStep>): ProviderStep[] {
    return (sourceSteps ?? []).map((step) => {
        const isDomainStep = 'id' in (step as any)
        if (isDomainStep) {
            const domainStep = step as Step
            return {
                action: safeStr(domainStep.action ?? domainStep.text),
                data: safeStr(domainStep.data),
                expected: safeStr(domainStep.expected),
                text: safeStr(domainStep.text),
                providerStepId: safeStr(domainStep.source?.sourceStepId) || undefined,
                attachments: (domainStep.attachments ?? []).map(cloneAttachment),
            }
        }

        const exportStep = step as ExportStep
        return {
            action: safeStr(exportStep.action),
            data: safeStr(exportStep.data),
            expected: safeStr(exportStep.expected),
            text: '',
            attachments: (exportStep.attachments ?? []).map(cloneAttachment),
        }
    })
}

function safeStr(value: unknown): string {
    return value == null ? '' : String(value)
}
