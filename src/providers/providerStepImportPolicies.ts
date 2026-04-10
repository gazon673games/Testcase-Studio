import type { Step } from '@core/domain'
import { applyZephyrHtmlPartsParsing } from '@core/zephyrHtmlParts'

export function applyProviderStepImportPolicies(
    step: Step,
    options?: { parseHtmlParts?: boolean; tolerantJsonBeautify?: boolean }
): Step {
    if (!options?.parseHtmlParts) return step
    return applyZephyrHtmlPartsParsing(step, { tolerant: options.tolerantJsonBeautify })
}
