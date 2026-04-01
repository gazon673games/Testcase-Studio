import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { registerHandlers } from '../src/ipc/handlers.js'

let win: BrowserWindow | null = null

function resolveRendererPath() {
    return path.join(app.getAppPath(), 'dist', 'index.html')
}

function resolvePreloadPath() {
    return path.join(app.getAppPath(), 'electron', 'preload.cjs')
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
        },
    })

    win.on('closed', () => {
        win = null
    })

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
