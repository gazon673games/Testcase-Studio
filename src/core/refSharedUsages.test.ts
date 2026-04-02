import { describe, expect, it } from 'vitest'
import { mkShared, mkStep, mkTest } from './domain'
import { buildSharedUsageIndex, collectSharedUsages, makeStepRef } from './refs'

describe('shared usage indexing', () => {
    it('indexes direct and reference usages for a shared item once', () => {
        const sharedLoginStep = mkStep('Open login page', '', '')
        sharedLoginStep.id = 'shared-login-step'

        const sharedLogin = mkShared('Reusable login', [sharedLoginStep])
        sharedLogin.id = 'shared-login'

        const nestedSharedUses = mkStep('', '', '')
        nestedSharedUses.id = 'shared-consumer-step-uses'
        nestedSharedUses.usesShared = sharedLogin.id

        const nestedSharedRef = mkStep(`Before [[${makeStepRef('shared', sharedLogin.id, sharedLoginStep.id, 'action')}]]`, '', '')
        nestedSharedRef.id = 'shared-consumer-step-ref'

        const sharedConsumer = mkShared('Shared consumer', [nestedSharedUses, nestedSharedRef])
        sharedConsumer.id = 'shared-consumer'

        const testStep = mkStep('Fill credentials', '', 'Signed in')
        testStep.id = 'test-billing-step'
        testStep.usesShared = sharedLogin.id

        const billingTest = mkTest(
            'Billing test',
            `See [[${makeStepRef('shared', sharedLogin.id, sharedLoginStep.id, 'action')}]]`
        )
        billingTest.id = 'test-billing'
        billingTest.steps = [testStep]

        const usageIndex = buildSharedUsageIndex([billingTest], [sharedLogin, sharedConsumer])
        const usages = usageIndex.get(sharedLogin.id) ?? []

        expect(usages.map((usage) => usage.id).sort()).toEqual([
            'ref:shared:shared-consumer:shared-consumer:shared-consumer-step-ref:action:[[shared:shared-login#shared-login-step.action]]',
            'ref:test:test-billing:test-billing:description:[[shared:shared-login#shared-login-step.action]]',
            'usesShared:shared:shared-consumer:shared-consumer-step-uses',
            'usesShared:test:test-billing:test-billing-step',
        ].sort())

        expect(usages.map((usage) => `${usage.kind}:${usage.ownerType}:${usage.ownerId}`).sort()).toEqual([
            'ref:shared:shared-consumer',
            'ref:test:test-billing',
            'usesShared:shared:shared-consumer',
            'usesShared:test:test-billing',
        ].sort())

        expect(collectSharedUsages(sharedLogin, [billingTest], [sharedLogin, sharedConsumer]).map((usage) => usage.id).sort()).toEqual(
            usages.map((usage) => usage.id).sort()
        )
    })

    it('does not count self references inside the same shared item as usage', () => {
        const primaryStep = mkStep('Open login page', '', '')
        primaryStep.id = 'shared-self-step-1'

        const internalRefStep = mkStep(`Reuse [[${makeStepRef('shared', 'shared-self', primaryStep.id, 'action')}]]`, '', '')
        internalRefStep.id = 'shared-self-step-2'
        internalRefStep.usesShared = 'shared-self'

        const sharedSelf = mkShared('Self linked', [primaryStep, internalRefStep])
        sharedSelf.id = 'shared-self'

        const usageIndex = buildSharedUsageIndex([], [sharedSelf])

        expect(usageIndex.get(sharedSelf.id) ?? []).toEqual([])
        expect(collectSharedUsages(sharedSelf, [], [sharedSelf])).toEqual([])
    })
})
