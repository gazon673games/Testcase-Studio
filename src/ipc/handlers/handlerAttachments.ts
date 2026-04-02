import { isManagedAttachmentRef } from '@core/attachments'
import { readManagedAttachmentBytes } from '../../../electron/attachmentStore.js'
import { ensureOk, fetchWithContext, readJsonResponse } from './handlerNetwork.js'
import type { ZephyrContext } from './handlerSettings.js'

async function attachmentToBuffer(pathOrDataUrl: string): Promise<Buffer> {
    const raw = String(pathOrDataUrl ?? '')
    if (isManagedAttachmentRef(raw)) {
        return await readManagedAttachmentBytes(raw)
    }

    const dataUrlMatch = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i)
    if (!dataUrlMatch) throw new Error('NOT_A_DATA_URL')

    const payload = dataUrlMatch[3] ?? ''
    return dataUrlMatch[2]
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8')
}

export async function uploadZephyrAttachment(
    context: ZephyrContext,
    testCaseKey: string,
    attachment: { name: string; pathOrDataUrl: string }
) {
    const normalizedKey = String(testCaseKey ?? '').trim()
    if (!normalizedKey) throw new Error('Zephyr attachment upload requires a test case key')

    const attachmentName = String(attachment?.name ?? '').trim() || 'attachment'
    const pathOrDataUrl = String(attachment?.pathOrDataUrl ?? '')
    if (!pathOrDataUrl) throw new Error(`Attachment "${attachmentName}" has no file content`)

    let bytes: Buffer
    try {
        bytes = await attachmentToBuffer(pathOrDataUrl)
    } catch {
        throw new Error(`Attachment "${attachmentName}" must be embedded as a data URL or stored in the workspace attachment store before upload`)
    }

    const form = new FormData()
    form.append('file', new Blob([Uint8Array.from(bytes)]), attachmentName)

    const response = await fetchWithContext(
        `${context.baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(normalizedKey)}/attachments`,
        {
            method: 'POST',
            body: form,
            headers: { Authorization: context.auth },
        },
        'Zephyr(upload attachment)'
    )

    await readJsonResponse(response, 'Zephyr(upload attachment)', 400, {})
}

export async function deleteZephyrAttachment(context: ZephyrContext, attachmentId: string) {
    const normalizedId = String(attachmentId ?? '').trim()
    if (!normalizedId) throw new Error('Zephyr attachment delete requires an attachment id')

    const response = await fetchWithContext(
        `${context.baseUrl}/rest/atm/1.0/attachment/${encodeURIComponent(normalizedId)}`,
        {
            method: 'DELETE',
            headers: { Authorization: context.auth, Accept: 'application/json' },
        },
        'Zephyr(delete attachment)'
    )

    await ensureOk(response, 'Zephyr(delete attachment)', 300)
}
