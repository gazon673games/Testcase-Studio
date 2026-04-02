import { randomUUID } from 'crypto'
import { promises as fsp } from 'fs'
import path from 'node:path'
import { shell } from 'electron'
import type { Attachment, RootState, SharedStep, Step, TestCase } from '../src/core/domain'
import { buildManagedAttachmentRef, parseManagedAttachmentRef } from '../src/core/attachments'
import { ensureDir, getRepoDir, joinInside } from './repo/repoShared'

const MANAGED_ATTACHMENTS_DIR = '.attachments-store'

function getManagedAttachmentsDir() {
    return joinInside(getRepoDir(), MANAGED_ATTACHMENTS_DIR)
}

function sanitizeAttachmentName(name: string) {
    const baseName = path.basename(String(name ?? '').trim() || 'attachment')
    return baseName.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-').slice(0, 120) || 'attachment'
}

function resolveManagedAttachmentPath(ref: string) {
    const relativePath = parseManagedAttachmentRef(ref)
    if (!relativePath) throw new Error('Attachment is not managed by the workspace')
    return joinInside(getManagedAttachmentsDir(), ...relativePath.split('/'))
}

export async function storeWorkspaceAttachments(
    files: Array<{ name: string; bytes: ArrayBuffer }>
): Promise<Attachment[]> {
    const storeDir = getManagedAttachmentsDir()
    await ensureDir(storeDir)

    const created: Attachment[] = []

    for (const file of files) {
        const id = randomUUID()
        const fileName = sanitizeAttachmentName(file.name)
        const relativePath = `${id}/${fileName}`
        const targetDir = joinInside(storeDir, id)
        const targetPath = joinInside(targetDir, fileName)
        await ensureDir(targetDir)
        await fsp.writeFile(targetPath, Buffer.from(new Uint8Array(file.bytes)))
        created.push({
            id,
            name: fileName,
            pathOrDataUrl: buildManagedAttachmentRef(relativePath),
        })
    }

    return created
}

export async function readManagedAttachmentBytes(ref: string): Promise<Buffer> {
    return await fsp.readFile(resolveManagedAttachmentPath(ref))
}

function tryDecodeDataUrl(raw: string): Buffer | null {
    const dataUrlMatch = raw.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i)
    if (!dataUrlMatch) return null

    const payload = dataUrlMatch[3] ?? ''
    return dataUrlMatch[2]
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8')
}

async function storeManagedAttachmentBytes(
    attachment: Attachment,
    bytes: Buffer
): Promise<Attachment> {
    const id = String(attachment.id ?? '').trim() || randomUUID()
    const fileName = sanitizeAttachmentName(attachment.name)
    const relativePath = `${id}/${fileName}`
    const storeDir = getManagedAttachmentsDir()
    const targetDir = joinInside(storeDir, id)
    const targetPath = joinInside(targetDir, fileName)
    await ensureDir(storeDir)
    await ensureDir(targetDir)
    await fsp.writeFile(targetPath, bytes)

    return {
        id,
        name: fileName,
        pathOrDataUrl: buildManagedAttachmentRef(relativePath),
    }
}

async function migrateAttachment(attachment: Attachment): Promise<boolean> {
    const bytes = tryDecodeDataUrl(attachment.pathOrDataUrl)
    if (!bytes) return false

    const managed = await storeManagedAttachmentBytes(attachment, bytes)
    attachment.id = managed.id
    attachment.name = managed.name
    attachment.pathOrDataUrl = managed.pathOrDataUrl
    return true
}

async function migrateAttachmentsList(attachments: Attachment[] | undefined): Promise<boolean> {
    let migrated = false

    for (const attachment of attachments ?? []) {
        if (await migrateAttachment(attachment)) {
            migrated = true
        }
    }

    return migrated
}

async function migrateStepAttachments(step: Step): Promise<boolean> {
    return await migrateAttachmentsList(step.attachments)
}

async function migrateTestAttachments(test: TestCase): Promise<boolean> {
    let migrated = await migrateAttachmentsList(test.attachments)

    for (const step of test.steps ?? []) {
        if (await migrateStepAttachments(step)) {
            migrated = true
        }
    }

    return migrated
}

async function migrateSharedAttachments(shared: SharedStep): Promise<boolean> {
    let migrated = false

    for (const step of shared.steps ?? []) {
        if (await migrateStepAttachments(step)) {
            migrated = true
        }
    }

    return migrated
}

export async function migrateWorkspaceAttachments(state: RootState): Promise<boolean> {
    let migrated = false

    const walkFolder = async (node: RootState['root'] | TestCase): Promise<void> => {
        if ('children' in node) {
            for (const child of node.children) {
                await walkFolder(child)
            }
            return
        }

        if (await migrateTestAttachments(node)) {
            migrated = true
        }
    }

    await walkFolder(state.root)

    for (const shared of state.sharedSteps) {
        if (await migrateSharedAttachments(shared)) {
            migrated = true
        }
    }

    return migrated
}

export async function openWorkspaceAttachment(ref: string): Promise<void> {
    const raw = String(ref ?? '').trim()
    if (!raw) return

    if (parseManagedAttachmentRef(raw)) {
        await shell.openPath(resolveManagedAttachmentPath(raw))
        return
    }

    if (/^(https?:|mailto:|file:)/i.test(raw)) {
        await shell.openExternal(raw)
        return
    }

    if (path.isAbsolute(raw)) {
        await shell.openPath(raw)
    }
}
