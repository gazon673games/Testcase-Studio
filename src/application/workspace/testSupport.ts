import { vi } from 'vitest'
import { mkFolder, mkStep, mkTest, type RootState, type TestCase } from '@core/domain'
import type {
    SyncService,
    ZephyrImportApplyResult,
    ZephyrImportPreview,
    ZephyrImportPreviewItem,
    ZephyrImportRequest,
    ZephyrPublishPreview,
    ZephyrPublishPreviewItem,
    ZephyrPublishResult,
} from '@app/sync'
import type { ProviderTest } from '@providers/types'

export function makeWorkspace() {
    const rootTest = mkTest('Root test')
    rootTest.id = 'test-root'
    rootTest.steps = [mkStep('Open root page', '', 'See page')]

    const folderTest = mkTest('Folder test')
    folderTest.id = 'test-folder'
    folderTest.steps = [mkStep('Open folder page', '', 'See page')]

    const childFolder = mkFolder('Billing', [folderTest])
    childFolder.id = 'folder-billing'

    const root = mkFolder('Root', [rootTest, childFolder])
    root.id = 'root'

    const state: RootState = {
        root,
        sharedSteps: [],
    }

    return {
        state,
        root,
        rootTest,
        childFolder,
        folderTest,
    }
}

export function makeProviderTest(overrides: Partial<ProviderTest> = {}): ProviderTest {
    return {
        id: 'PROJ-T1',
        name: 'Remote case',
        description: 'Remote description',
        steps: [{ action: 'Remote action', data: '', expected: 'Remote expected', text: 'Remote action' }],
        attachments: [],
        updatedAt: '2026-04-02T12:00:00.000Z',
        extras: {},
        ...overrides,
    }
}

export function makeImportItem(overrides: Partial<ZephyrImportPreviewItem> = {}): ZephyrImportPreviewItem {
    const remote = overrides.remote ?? makeProviderTest({ id: 'PROJ-T1', name: 'Remote case' })

    return {
        id: 'import-item-1',
        remote,
        remoteId: remote.id,
        remoteName: remote.name,
        localMatchIds: [],
        status: 'update',
        reason: 'Remote changed',
        strategy: 'replace',
        targetFolderSegments: [],
        targetFolderLabel: 'Workspace',
        diffs: [],
        ...overrides,
    }
}

export function makeImportPreview(
    request: ZephyrImportRequest,
    items: ZephyrImportPreviewItem[] = []
): ZephyrImportPreview {
    return {
        request,
        query: request.rawQuery ?? request.projectKey ?? request.folder ?? (request.refs ?? []).join(','),
        destinationFolderId: request.destinationFolderId,
        destinationFolderLabel: 'Workspace',
        generatedAt: '2026-04-02T12:00:00.000Z',
        items,
        summary: {
            total: items.length,
            created: items.filter((item) => item.status === 'new').length,
            unchanged: items.filter((item) => item.status === 'unchanged').length,
            updates: items.filter((item) => item.status === 'update').length,
            conflicts: items.filter((item) => item.status === 'conflict').length,
        },
    }
}

export function makePublishItem(overrides: Partial<ZephyrPublishPreviewItem> = {}): ZephyrPublishPreviewItem {
    const payload =
        overrides.payload ?? makeProviderTest({ id: overrides.externalId ?? 'PROJ-T1', name: overrides.testName ?? 'Case' })

    return {
        id: 'publish-item-1',
        testId: 'test-root',
        testName: 'Root test',
        status: 'update',
        reason: 'Remote changed',
        publish: true,
        diffs: [],
        payload,
        attachmentsToUpload: [],
        attachmentIdsToDelete: [],
        attachmentWarnings: [],
        ...overrides,
    }
}

export function makePublishPreview(selectionLabel: string, items: ZephyrPublishPreviewItem[]): ZephyrPublishPreview {
    return {
        selectionLabel,
        generatedAt: '2026-04-02T12:00:00.000Z',
        items,
        summary: {
            total: items.length,
            create: items.filter((item) => item.status === 'create').length,
            update: items.filter((item) => item.status === 'update').length,
            skip: items.filter((item) => item.status === 'skip').length,
            blocked: items.filter((item) => item.status === 'blocked').length,
        },
    }
}

export function makePublishResult(logItems: ZephyrPublishResult['logItems']): ZephyrPublishResult {
    return {
        created: logItems.filter((item) => item.status === 'created').length,
        updated: logItems.filter((item) => item.status === 'updated').length,
        skipped: logItems.filter((item) => item.status === 'skipped').length,
        failed: logItems.filter((item) => item.status === 'failed').length,
        blocked: logItems.filter((item) => item.status === 'blocked').length,
        logItems,
    }
}

export function makeSyncService(overrides: Partial<SyncService> = {}): SyncService {
    return {
        pullByLink: vi.fn(async () => makeProviderTest()),
        pushTest: vi.fn(async () => ({ externalId: 'PROJ-T1' })),
        pullPreferZephyr: vi.fn(async () => null),
        previewZephyrImport: vi.fn(async (_state: RootState, request: ZephyrImportRequest) => makeImportPreview(request)),
        applyZephyrImport: vi.fn((): ZephyrImportApplyResult => ({
            created: 0,
            createdTestIds: [],
            updated: 0,
            updatedTestIds: [],
            skipped: 0,
            drafts: 0,
            unchanged: 0,
        })),
        previewZephyrPublish: vi.fn(async (_state: RootState, tests: TestCase[], selectionLabel: string) =>
            makePublishPreview(
                selectionLabel,
                tests.map((test) =>
                    makePublishItem({
                        id: `publish-${test.id}`,
                        testId: test.id,
                        testName: test.name,
                    })
                )
            )
        ),
        publishZephyrPreview: vi.fn(async (_state: RootState, preview: ZephyrPublishPreview) =>
            makePublishResult(
                preview.items.map((item) => ({
                    testId: item.testId,
                    testName: item.testName,
                    status: 'updated',
                }))
            )
        ),
        twoWaySync: vi.fn(async () => {}),
        ...overrides,
    }
}
