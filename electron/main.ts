import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { registerHandlers } from '../src/ipc/handlers.js'

let win: BrowserWindow | null = null

function resolveRendererPath() {
    return path.join(app.getAppPath(), 'dist', 'index.html')
}

function resolvePreloadPath() {
    return path.join(app.getAppPath(), 'electron', 'preload.cjs')
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
    win = new BrowserWindow({
        width: 1200,
        height: 800,
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
