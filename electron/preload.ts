const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron')

type RendererListener = (event: unknown, data: unknown) => void
type WrappedRendererListener = (event: unknown, data: unknown) => void

const listenerMap = new Map<string, WeakMap<RendererListener, WrappedRendererListener>>()

function getChannelListeners(channel: string) {
    let channelListeners = listenerMap.get(channel)
    if (!channelListeners) {
        channelListeners = new WeakMap<RendererListener, WrappedRendererListener>()
        listenerMap.set(channel, channelListeners)
    }
    return channelListeners
}

contextBridge.exposeInMainWorld('api', {
    invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
    on: (channel: string, listener: RendererListener) => {
        const channelListeners = getChannelListeners(channel)
        const existing = channelListeners.get(listener)
        if (existing) ipcRenderer.off(channel, existing)

        const wrapped: WrappedRendererListener = (_event: unknown, data: unknown) => listener(_event, data)
        channelListeners.set(listener, wrapped)
        ipcRenderer.on(channel, wrapped)

        return () => {
            const current = channelListeners.get(listener)
            if (!current) return
            ipcRenderer.off(channel, current)
            channelListeners.delete(listener)
        }
    },
    off: (channel: string, listener: RendererListener) => {
        const wrapped = listenerMap.get(channel)?.get(listener)
        if (!wrapped) return
        ipcRenderer.off(channel, wrapped)
        listenerMap.get(channel)?.delete(listener)
    },
})
