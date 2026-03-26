import { contextBridge as f, ipcRenderer as n } from "electron";
f.exposeInMainWorld("api", {
  invoke: (o, e) => n.invoke(o, e),
  on: (o, e) => {
    n.on(o, (i, r) => e(i, r));
  },
  off: (o, e) => {
    n.off(o, e);
  }
});
//# sourceMappingURL=preload.mjs.map
