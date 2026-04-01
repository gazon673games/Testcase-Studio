const { contextBridge, ipcRenderer } = require('electron')

const listenerMap = new Map()

function getChannelListeners(channel) {
    let channelListeners = listenerMap.get(channel)
    if (!channelListeners) {
        channelListeners = new WeakMap()
        listenerMap.set(channel, channelListeners)
    }
    return channelListeners
}

contextBridge.exposeInMainWorld('api', {
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
    on: (channel, listener) => {
        const channelListeners = getChannelListeners(channel)
        const existing = channelListeners.get(listener)
        if (existing) ipcRenderer.off(channel, existing)

        const wrapped = (_event, data) => listener(_event, data)
        channelListeners.set(listener, wrapped)
        ipcRenderer.on(channel, wrapped)

        return () => {
            const current = channelListeners.get(listener)
            if (!current) return
            ipcRenderer.off(channel, current)
            channelListeners.delete(listener)
        }
    },
    off: (channel, listener) => {
        const wrapped = listenerMap.get(channel)?.get(listener)
        if (!wrapped) return
        ipcRenderer.off(channel, wrapped)
        listenerMap.get(channel)?.delete(listener)
    },
})
