import { mkFolder, mkTest, mkStep, mkShared, nowISO, type RootState } from '@core/domain'
import { insertChild, deleteNode, mapTests } from '@core/tree'
import { loadWorkspaceState, saveWorkspaceState } from '@app/workspace'
import { SyncEngine, createSyncText } from '@app/sync'
import { ZephyrMockProvider } from '@providers/zephyr/zephyr.mock'
import { AllureStubProvider } from '@providers/allure.stub'
import { v4 as uuid } from 'uuid'

export async function runConsoleScript() {
    console.log('--- Console demo starting ---')
    let state: RootState = await loadWorkspaceState()
    console.log('Loaded state:', JSON.parse(JSON.stringify(state)))

    // 1) create initial structure: Folder → Subfolder → Test
    const features = mkFolder('Features')
    const auth = mkFolder('Auth')
    const loginTest = mkTest('User can log in', 'Basic login flow')

    loginTest.steps.push(
        mkStep('Navigate to /login'),
        mkStep('Enter username and password', 'Credentials accepted'),
        mkStep('Click Submit', 'User lands on dashboard')
    )

    insertChild(state.root, state.root.id, features)
    insertChild(state.root, features.id, auth)
    insertChild(state.root, auth.id, loginTest)
    console.log('Created tree with one test:', JSON.parse(JSON.stringify(state.root)))

    // 2) shared/common steps
    const shared = mkShared('Precondition: User exists', [
        mkStep('Ensure user record exists in DB'),
        mkStep('Ensure user is active')
    ])
    state.sharedSteps.push(shared)

    // mark first step in test as using shared steps (simple pointer)
    loginTest.steps[0].usesShared = shared.id
    loginTest.updatedAt = nowISO()

    // 3) attach a file (path or data URL; for demo we use a fake path)
    loginTest.attachments.push({ id: uuid(), name: 'login-screenshot.png', pathOrDataUrl: '/fake/path/login.png' })
    loginTest.updatedAt = nowISO()

    // 4) link test to Zephyr (mock)
    const zephyrId = uuid()
    loginTest.links.push({ provider: 'zephyr', externalId: zephyrId })
    loginTest.updatedAt = nowISO()

    await saveWorkspaceState(state)
    console.log('Saved state.')

    // 5) set up providers + sync engine
    const sync = new SyncEngine({
        zephyr: new ZephyrMockProvider(),
        allure: new AllureStubProvider()
    }, createSyncText((key) => key))

    // 6) pull details from Zephyr mock
    const pulled = await sync.pullByLink(loginTest.links[0])
    console.log('[Zephyr Mock] pulled details:', pulled)

    // 7) push local test to Zephyr (upsert)
    const pushRes = await sync.pushTest(loginTest, loginTest.links[0], state)
    console.log('[Zephyr Mock] pushed test, externalId:', pushRes.externalId)

    // 8) modify local test and two-way sync (naive strategy)
    loginTest.description = 'Basic login flow (edited)'
    loginTest.steps.push(mkStep('Verify user menu appears', 'Menu visible'))
    loginTest.updatedAt = nowISO()
    await sync.twoWaySync(state)
    console.log('After two-way sync:', mapTests(state.root))

    // 9) delete the test to prove CRUD
    const deleted = deleteNode(state.root, loginTest.id)
    console.log('Deleted local test?', deleted)

    await saveWorkspaceState(state)
    console.log('State saved again. Open DevTools console to inspect objects.')
    console.log('--- Console demo complete ---')
}
