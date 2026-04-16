import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { BrowserWindow, dialog, nativeImage } from 'electron'
import { getAppDataRoot } from './runtimePaths.js'

const ICON_FILE_NAME = 'app.png'
const ICON_SIZE = 256

function getWindowIconPath() {
    return path.join(getAppDataRoot(), '.local-assets', 'icons', ICON_FILE_NAME)
}

async function applyIconToWindows(image: Electron.NativeImage) {
    for (const win of BrowserWindow.getAllWindows()) {
        win.setIcon(image)
    }
}

export async function getWindowIconDataUrl(): Promise<string | null> {
    const iconPath = getWindowIconPath()
    try {
        const bytes = await fsp.readFile(iconPath)
        return `data:image/png;base64,${bytes.toString('base64')}`
    } catch {
        return null
    }
}

export async function setWindowIconFromBuffer(pngBytes: ArrayBuffer): Promise<string> {
    const iconPath = getWindowIconPath()
    await fsp.mkdir(path.dirname(iconPath), { recursive: true })

    const buffer = Buffer.from(pngBytes)
    await fsp.writeFile(iconPath, buffer)

    const image = nativeImage.createFromBuffer(buffer)
    await applyIconToWindows(image)

    return `data:image/png;base64,${buffer.toString('base64')}`
}

export async function pickAndSetWindowIcon(): Promise<string | null> {
    const selection = await dialog.showOpenDialog({
        title: 'Choose app icon',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'ico', 'jpg', 'jpeg', 'webp'] }],
    })

    if (selection.canceled || !selection.filePaths.length) return null

    const sourcePath = selection.filePaths[0]
    const image = nativeImage.createFromPath(sourcePath)
    if (image.isEmpty()) throw new Error(`Unsupported image: ${sourcePath}`)

    const resized = image.resize({ width: ICON_SIZE, height: ICON_SIZE, quality: 'best' })
    const pngBytes = resized.toPNG()

    const iconPath = getWindowIconPath()
    await fsp.mkdir(path.dirname(iconPath), { recursive: true })
    await fsp.writeFile(iconPath, pngBytes)

    await applyIconToWindows(resized)

    return `data:image/png;base64,${pngBytes.toString('base64')}`
}

export async function resetWindowIcon(): Promise<void> {
    const iconPath = getWindowIconPath()
    try {
        await fsp.unlink(iconPath)
    } catch {
        // File may not exist — ignore
    }
}
