import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
    invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
    on: (channel: string, listener: (event: unknown, data: unknown) => void) => {
        ipcRenderer.on(channel, (_e, data) => listener(_e, data))
    },
    off: (channel: string, listener: (...args: any[]) => void) => {
        ipcRenderer.off(channel, listener)
    }
})
