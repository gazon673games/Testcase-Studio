import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("api", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, listener) => {
    ipcRenderer.on(channel, (_e, data) => listener(_e, data));
  },
  off: (channel, listener) => {
    ipcRenderer.off(channel, listener);
  }
});
//# sourceMappingURL=preload.mjs.map
