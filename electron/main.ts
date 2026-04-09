import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { registerHandlers } from '../src/ipc/handlers.js'

let win: BrowserWindow | null = null

function resolveRendererPath() {
    return path.join(app.getAppPath(), 'dist', 'index.html')
}

function resolvePreloadPath() {
    return path.join(app.getAppPath(), 'electron', 'preload.cjs')
}

function resolveLocalWindowIconPath() {
    const projectRoot = app.getAppPath()
    const iconDir = path.join(projectRoot, '.local-assets', 'icons')
    const candidates = process.platform === 'win32'
        ? ['app.ico', 'app.png']
        : process.platform === 'linux'
            ? ['app.png']
            : ['app.png', 'app.icns']

    for (const name of candidates) {
        const target = path.join(iconDir, name)
        if (fs.existsSync(target)) return target
    }
    return undefined
}

function isSafeExternalUrl(url: string) {
    try {
        const parsed = new URL(url)
        const protocol = parsed.protocol.toLowerCase()
        return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:'
    } catch {
        return false
    }
}

function configureWindowSecurity(window: BrowserWindow) {
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url)
        }
        return { action: 'deny' }
    })

    window.webContents.on('will-navigate', (event, url) => {
        if (url === window.webContents.getURL()) return
        event.preventDefault()
        if (isSafeExternalUrl(url)) {
            void shell.openExternal(url)
        }
    })
}

async function loadRenderer(window: BrowserWindow) {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (!devUrl) {
        await window.loadFile(resolveRendererPath())
        return
    }

    try {
        await window.loadURL(devUrl)
        window.webContents.openDevTools({ mode: 'detach' })
    } catch (error) {
        console.error('Failed to load renderer dev URL:', devUrl, error)
        await window.loadFile(resolveRendererPath())
    }
}

async function createWindow() {
    const icon = resolveLocalWindowIconPath()
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        ...(icon ? { icon } : {}),
        webPreferences: {
            preload: resolvePreloadPath(),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            sandbox: true,
            safeDialogs: true,
        },
    })

    win.on('closed', () => {
        win = null
    })

    configureWindowSecurity(win)
    await loadRenderer(win)
}

app.whenReady().then(() => {
    registerHandlers(ipcMain)
    void createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
