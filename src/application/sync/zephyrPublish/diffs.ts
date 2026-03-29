import { buildPreviewStepDiffRows, summarizePreviewSteps, summarizePreviewText, type PreviewStepDiffRow } from '@core/previewDiff'
import { translate } from '@shared/i18n'
import type { ProviderTest } from '@providers/types'
import { summarizeAttachments } from './attachments'
import { normalizeLabels, safeString, summarizeStructuredValue } from './common'
import type { ZephyrPublishDiff, ZephyrPublishDiffField } from './types'

export function diffPayloadAgainstRemote(local: ProviderTest, remote: ProviderTest): ZephyrPublishDiff[] {
    const t = translate
    const diffs: ZephyrPublishDiff[] = []
    pushDiff(diffs, 'name', t('publish.diff.name'), local.name, remote.name)
    pushDiff(
        diffs,
        'description',
        t('publish.diff.description'),
        summarizePreviewText(local.description),
        summarizePreviewText(remote.description)
    )
    pushDiff(
        diffs,
        'steps',
        t('publish.diff.steps'),
        summarizePreviewSteps(local.steps),
        summarizePreviewSteps(remote.steps),
        buildPreviewStepDiffRows(local.steps, remote.steps)
    )
    pushDiff(
        diffs,
        'objective',
        t('publish.diff.objective'),
        summarizePreviewText(safeString(local.extras?.objective)),
        summarizePreviewText(safeString(remote.extras?.objective))
    )
    pushDiff(
        diffs,
        'preconditions',
        t('publish.diff.preconditions'),
        summarizePreviewText(safeString(local.extras?.preconditions)),
        summarizePreviewText(safeString(remote.extras?.preconditions))
    )
    pushDiff(diffs, 'attachments', t('publish.diff.attachments'), summarizeAttachments(local), summarizeAttachments(remote))
    pushDiff(
        diffs,
        'folder',
        t('publish.diff.folder'),
        safeString(local.extras?.folder) ?? t('publish.diff.noFolder'),
        safeString(remote.extras?.folder) ?? t('publish.diff.noFolder')
    )
    pushDiff(diffs, 'labels', t('publish.diff.labels'), summarizeLabels(local.extras?.labels), summarizeLabels(remote.extras?.labels))
    pushDiff(
        diffs,
        'customFields',
        t('publish.diff.customFields'),
        summarizeStructuredValue(local.extras?.customFields, t('publish.summary.noCustomFields')),
        summarizeStructuredValue(remote.extras?.customFields, t('publish.summary.noCustomFields'))
    )
    pushDiff(
        diffs,
        'parameters',
        t('publish.diff.parameters'),
        summarizeStructuredValue(local.extras?.parameters, t('publish.summary.noParameters')),
        summarizeStructuredValue(remote.extras?.parameters, t('publish.summary.noParameters'))
    )
    return diffs
}

export function buildCreateDiffs(local: ProviderTest): ZephyrPublishDiff[] {
    const t = translate
    return [
        { field: 'name', label: t('publish.diff.name'), local: local.name, remote: t('publish.diff.noRemote') },
        {
            field: 'steps',
            label: t('publish.diff.steps'),
            local: summarizePreviewSteps(local.steps),
            remote: t('publish.diff.noRemote'),
            stepRows: buildPreviewStepDiffRows(local.steps, []),
        },
        {
            field: 'folder',
            label: t('publish.diff.folder'),
            local: safeString(local.extras?.folder) ?? t('publish.diff.noFolder'),
            remote: t('publish.diff.noRemote'),
        },
        {
            field: 'attachments',
            label: t('publish.diff.attachments'),
            local: summarizeAttachments(local),
            remote: t('publish.diff.noRemote'),
        },
        {
            field: 'customFields',
            label: t('publish.diff.customFields'),
            local: summarizeStructuredValue(local.extras?.customFields, t('publish.summary.noCustomFields')),
            remote: t('publish.diff.noRemote'),
        },
        {
            field: 'parameters',
            label: t('publish.diff.parameters'),
            local: summarizeStructuredValue(local.extras?.parameters, t('publish.summary.noParameters')),
            remote: t('publish.diff.noRemote'),
        },
    ]
}

function summarizeLabels(value: unknown): string {
    const t = translate
    const labels = normalizeLabels(value)
    return labels.length ? labels.join(', ') : t('publish.summary.noLabels')
}

function pushDiff(
    diffs: ZephyrPublishDiff[],
    field: ZephyrPublishDiffField,
    label: string,
    local: string,
    remote: string,
    stepRows?: PreviewStepDiffRow[]
) {
    const hasStepChanges = !!stepRows?.some((row) => row.changed)
    if (local === remote && !hasStepChanges) return
    diffs.push({ field, label, local, remote, ...(stepRows?.length ? { stepRows } : {}) })
}
