import type { SharedStep, TestCase } from '../domain'
import type { RefCatalog } from './refTypes'

export function buildRefCatalog(allTests: TestCase[], sharedSteps: SharedStep[]): RefCatalog {
    const testsById = new Map<string, TestCase>()
    const testsByName = new Map<string, TestCase[]>()
    const sharedById = new Map<string, SharedStep>()
    const sharedByName = new Map<string, SharedStep[]>()

    for (const test of allTests) {
        testsById.set(test.id, test)
        const list = testsByName.get(test.name)
        if (list) list.push(test)
        else testsByName.set(test.name, [test])
    }

    for (const shared of sharedSteps) {
        sharedById.set(shared.id, shared)
        const list = sharedByName.get(shared.name)
        if (list) list.push(shared)
        else sharedByName.set(shared.name, [shared])
    }

    return { testsById, testsByName, sharedById, sharedByName }
}
