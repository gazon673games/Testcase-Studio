import { describe, expect, it } from 'vitest'
import { buildAutocompleteIndex } from './autocompleteIndex'
import {
    makeFieldSuggestions,
    makeOwnerSuggestions,
    makePartSuggestions,
    makeStepSuggestions,
} from './autocomplete'
import type { RefShared, RefTest } from './types'

const t = (key: string, params?: Record<string, string | number>) => {
    switch (key) {
        case 'markdown.testLabel':
            return `Test: ${params?.name}`
        case 'markdown.sharedLabel':
            return `Shared: ${params?.name}`
        case 'steps.action':
            return 'Action'
        case 'steps.data':
            return 'Data'
        case 'steps.expected':
            return 'Expected'
        case 'steps.stepNumber':
            return `Step ${params?.index}`
        case 'markdown.emptyValue':
            return 'Empty'
        case 'markdown.wholeField':
            return 'Whole field'
        default:
            return key
    }
}

const resolveDisplayText = (value: string | undefined) => String(value ?? '')

describe('markdown autocomplete indexing', () => {
    const tests: RefTest[] = [
        {
            id: 'test-billing',
            name: 'Billing case',
            steps: [
                {
                    id: 'step-open',
                    action: 'Open invoice screen',
                    data: 'customer-42',
                    expected: 'Invoice screen appears',
                    presentation: {
                        parts: {
                            action: [{ id: 'action-part-1', text: 'Click the invoice row' }],
                            data: [],
                            expected: [],
                        },
                    },
                },
            ],
        },
    ]

    const sharedSteps: RefShared[] = [
        {
            id: 'shared-login',
            name: 'Reusable login',
            steps: [
                {
                    id: 'shared-step-login',
                    action: 'Enter credentials',
                    expected: 'User is signed in',
                },
            ],
        },
    ]

    const index = buildAutocompleteIndex(tests, sharedSteps, resolveDisplayText)

    it('suggests owners from the prebuilt owner index', () => {
        expect(makeOwnerSuggestions(index, 'billing', t).map((item) => item.insert)).toEqual(['id:test-billing#'])
        expect(makeOwnerSuggestions(index, 'shared:shared-log', t).map((item) => item.insert)).toEqual(['shared:shared-login#'])
    })

    it('suggests steps and fields from the prebuilt step index', () => {
        const steps = makeStepSuggestions('id:test-billing', 'invoice', index, t)
        const fields = makeFieldSuggestions('id:test-billing', '1', 'act', index, t)

        expect(steps[0]).toMatchObject({
            insert: 'id:test-billing#step-open.',
            continues: true,
        })
        expect(fields[0]).toMatchObject({
            insert: 'id:test-billing#step-open.action@',
            continues: true,
        })
    })

    it('suggests whole-field and part references from indexed field data', () => {
        const parts = makePartSuggestions('id:test-billing', '1', 'action', 'invoice', index, t)

        expect(parts.map((item) => item.insert)).toEqual([
            'id:test-billing#step-open.action',
            'id:test-billing#step-open.action@action-part-1',
        ])
    })
})
