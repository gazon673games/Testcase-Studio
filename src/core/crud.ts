import { nowISO, type Folder, type TestCase, type Step, type ID } from './domain'
import { isFolder } from './tree'

export function renameFolder(folder: Folder, name: string) { folder.name = name }
export function renameTest(test: TestCase, name: string) { test.name = name; touch(test) }
export function setTestDescription(test: TestCase, description: string) { test.description = description; touch(test) }

export function addStep(test: TestCase, step: Step) { test.steps.push(step); touch(test) }
export function removeStep(test: TestCase, stepId: ID) {
    test.steps = test.steps.filter(s => s.id !== stepId); touch(test)
}
export function moveStep(test: TestCase, from: number, to: number) {
    const [s] = test.steps.splice(from, 1)
    test.steps.splice(to, 0, s); touch(test)
}

export function linkProvider(test: TestCase, provider: 'zephyr'|'allure', externalId: string) {
    const i = test.links.findIndex(l => l.provider === provider)
    if (i >= 0) test.links[i].externalId = externalId
    else test.links.push({ provider, externalId })
    touch(test)
}
export function unlinkProvider(test: TestCase, provider: 'zephyr'|'allure') {
    test.links = test.links.filter(l => l.provider !== provider); touch(test)
}

function touch(test: TestCase) { test.updatedAt = nowISO() }
