var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
import { contextBridge, ipcRenderer } from "electron";
var require_preload = __commonJS({
  "preload.cjs"() {
    contextBridge.exposeInMainWorld("api", {
      invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
      on: (channel, listener) => {
        ipcRenderer.on(channel, (_e, data) => listener(_e, data));
      },
      off: (channel, listener) => {
        ipcRenderer.off(channel, listener);
      }
    });
  }
});
export default require_preload();
//# sourceMappingURL=preload.cjs.map
