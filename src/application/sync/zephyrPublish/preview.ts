import { nowISO, type RootState, type TestCase } from '@core/domain'
import { ExportIntegrityError } from '@core/export'
import type { ProviderTest } from '@providers/types'
import type { SyncText } from '../text'
import { buildAttachmentPlan, collectAttachmentWarnings, collectProviderAttachments } from './attachments'
import { safeString } from './common'
import { buildCreateDiffs, diffPayloadAgainstRemote } from './diffs'
import { buildZephyrPublishPayload, createZephyrPublishPayloadContext } from './payload'
import type { ZephyrPublishPreview, ZephyrPublishPreviewItem } from './types'

export function buildZephyrPublishPreview(
    state: RootState,
    tests: TestCase[],
    remoteMap: Map<string, ProviderTest | Error>,
    selectionLabel: string,
    text: SyncText
): ZephyrPublishPreview {
    const payloadContext = createZephyrPublishPayloadContext(state)
    const items = tests.map((test) => buildPreviewItem(state, test, remoteMap, text, payloadContext))

    return {
        selectionLabel,
        generatedAt: nowISO(),
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

function buildPreviewItem(
    state: RootState,
    test: TestCase,
    remoteMap: Map<string, ProviderTest | Error>,
    text: SyncText,
    payloadContext: Parameters<typeof buildZephyrPublishPayload>[2]
): ZephyrPublishPreviewItem {
    const t = text.t
    let payload: ProviderTest
    try {
        payload = buildZephyrPublishPayload(test, state, payloadContext)
    } catch (error) {
        const reason =
            error instanceof ExportIntegrityError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : String(error)
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            status: 'blocked',
            reason,
            publish: false,
            diffs: [],
            payload: {
                id: '',
                name: test.name,
                description: '',
                steps: [],
                attachments: [],
                updatedAt: nowISO(),
                extras: {},
            },
            attachmentsToUpload: [],
            attachmentIdsToDelete: [],
            attachmentWarnings: [],
        }
    }
    const externalId = safeString(payload.id)
    const projectKey = safeString(payload.extras?.projectKey)
    const folder = safeString(payload.extras?.folder)
    const localAttachments = collectProviderAttachments(payload)

    if (!externalId && !projectKey) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            status: 'blocked',
            reason: t('publish.reason.missingProjectKey'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, [], t),
        }
    }

    if (!externalId) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            projectKey,
            folder,
            status: 'create',
            reason: t('publish.reason.create'),
            publish: true,
            diffs: buildCreateDiffs(payload, t),
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, [], t),
        }
    }

    const remote = remoteMap.get(externalId)
    if (remote instanceof Error) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'blocked',
            reason: remote.message || t('publish.reason.remoteLoadFailed'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, [], t),
        }
    }

    if (!remote) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'blocked',
            reason: t('publish.reason.remoteUnavailable'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: localAttachments,
            attachmentIdsToDelete: [],
            attachmentWarnings: collectAttachmentWarnings(localAttachments, [], t),
        }
    }

    const remoteAttachments = collectProviderAttachments(remote)
    const attachmentPlan = buildAttachmentPlan(localAttachments, remoteAttachments)
    let diffs = diffPayloadAgainstRemote(payload, remote, t)
    const parameterMode = safeString(payload.extras?.__parametersMode)
    const hasStepDiff = diffs.some((diff) => diff.field === 'steps')
    if (!hasStepDiff && parameterMode === 'inferred') {
        diffs = diffs.filter((diff) => diff.field !== 'parameters')
        if (payload.extras && typeof payload.extras === 'object') {
            delete (payload.extras as Record<string, unknown>).parameters
        }
    }
    if (payload.extras && typeof payload.extras === 'object') {
        ;(payload.extras as Record<string, unknown>).__changedFields = diffs.map((diff) => diff.field)
    }
    if (diffs.length === 0) {
        return {
            id: test.id,
            testId: test.id,
            testName: test.name,
            externalId,
            projectKey,
            folder,
            status: 'skip',
            reason: t('publish.reason.skip'),
            publish: false,
            diffs: [],
            payload,
            attachmentsToUpload: attachmentPlan.uploads,
            attachmentIdsToDelete: attachmentPlan.deleteIds,
            attachmentWarnings: collectAttachmentWarnings(localAttachments, remoteAttachments, t),
        }
    }

    return {
        id: test.id,
        testId: test.id,
        testName: test.name,
        externalId,
        projectKey,
        folder,
        status: 'update',
        reason: t('publish.reason.update'),
        publish: true,
        diffs,
        payload,
        attachmentsToUpload: attachmentPlan.uploads,
        attachmentIdsToDelete: attachmentPlan.deleteIds,
        attachmentWarnings: collectAttachmentWarnings(localAttachments, remoteAttachments, t),
    }
}
