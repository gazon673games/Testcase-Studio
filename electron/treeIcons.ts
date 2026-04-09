import { randomUUID } from 'node:crypto'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { dialog, nativeImage } from 'electron'
import type { LocalTreeIconOption } from '../src/shared/treeIcons.js'
import { getAppDataRoot } from './runtimePaths.js'

const OUTPUT_ICON_SIZE = 48

const MIME_BY_EXTENSION: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
}

function toLabel(fileName: string) {
    return path
        .parse(fileName)
        .name
        .replace(/__[\da-f]{8}$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function toSafeFileStem(value: string) {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'icon'
    )
}

function getIconDirectories() {
    const appDataRoot = getAppDataRoot()
    const directories = [
        path.join(appDataRoot, '.local-assets', 'tree-icons'),
        path.join(appDataRoot, '.local-assets', 'test-icons'),
    ]
    return [...new Set(directories.map((dirPath) => path.resolve(dirPath)))]
}

function isAllowedIconName(fileName: string) {
    return path.basename(fileName) === fileName && Boolean(MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()])
}

async function resolveLocalTreeIconPath(iconKey: string) {
    if (!isAllowedIconName(iconKey)) return null

    for (const directory of getIconDirectories()) {
        const filePath = path.join(directory, iconKey)
        try {
            const stat = await fsp.stat(filePath)
            if (stat.isFile()) return filePath
        } catch {
            // Continue searching other local icon folders.
        }
    }

    return null
}

async function toIconOption(filePath: string): Promise<LocalTreeIconOption | null> {
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = MIME_BY_EXTENSION[extension]
    if (!mimeType) return null

    const bytes = await fsp.readFile(filePath)
    const fileName = path.basename(filePath)
    return {
        key: fileName,
        label: toLabel(fileName) || fileName,
        dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
    }
}

export async function listLocalTreeIcons(): Promise<LocalTreeIconOption[]> {
    const filesByName = new Map<string, string>()

    for (const directory of getIconDirectories()) {
        try {
            const entries = await fsp.readdir(directory, { withFileTypes: true })
            for (const entry of entries) {
                if (!entry.isFile()) continue
                const extension = path.extname(entry.name).toLowerCase()
                if (!MIME_BY_EXTENSION[extension]) continue
                if (filesByName.has(entry.name)) continue
                filesByName.set(entry.name, path.join(directory, entry.name))
            }
        } catch {
            // Ignore missing local icon folders.
        }
    }

    const options = await Promise.all(
        [...filesByName.entries()]
            .sort(([left], [right]) => left.localeCompare(right, 'en', { sensitivity: 'base' }))
            .map(([, filePath]) => toIconOption(filePath))
    )

    return options.filter((option): option is LocalTreeIconOption => Boolean(option))
}

export async function importLocalTreeIcon(): Promise<LocalTreeIconOption | null> {
    const selection = await dialog.showOpenDialog({
        title: 'Choose icon image',
        properties: ['openFile'],
        filters: [
            {
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
            },
        ],
    })

    if (selection.canceled || !selection.filePaths.length) return null

    const sourcePath = selection.filePaths[0]
    const image = nativeImage.createFromPath(sourcePath)
    if (image.isEmpty()) {
        throw new Error(`Unsupported image: ${sourcePath}`)
    }

    const resizedImage = image.resize({
        width: OUTPUT_ICON_SIZE,
        height: OUTPUT_ICON_SIZE,
        quality: 'best',
    })

    const fileStem = toSafeFileStem(path.parse(sourcePath).name)
    const fileName = `${fileStem}__${randomUUID().slice(0, 8)}.png`
    const importedTreeIconDir = path.join(getAppDataRoot(), '.local-assets', 'tree-icons')
    const targetPath = path.join(importedTreeIconDir, fileName)

    await fsp.mkdir(importedTreeIconDir, { recursive: true })
    await fsp.writeFile(targetPath, resizedImage.toPNG())

    return await toIconOption(targetPath)
}

export async function deleteLocalTreeIcon(iconKey: string): Promise<boolean> {
    const targetPath = await resolveLocalTreeIconPath(String(iconKey ?? '').trim())
    if (!targetPath) return false

    await fsp.unlink(targetPath)
    return true
}
