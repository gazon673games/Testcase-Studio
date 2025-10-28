import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { registerHandlers } from '../src/ipc/handlers.js'

let win: BrowserWindow | null = null

async function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    })


    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';

    if (devUrl) {
        try {
            await win.loadURL(devUrl)
            win.webContents.openDevTools({ mode: 'detach' })
        } catch (err) {
            console.error('Failed to load renderer dev URL:', devUrl, err)
            // запасной вариант: грузим из сборки
            await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
        }
    } else {
        await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
    }
}

app.whenReady().then(() => {
    registerHandlers(ipcMain) // wire up IPC endpoints
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
