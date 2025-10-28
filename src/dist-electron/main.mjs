import { app, BrowserWindow, ipcMain } from "electron";
import path, { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
class FileStore {
  constructor(filename, defaults) {
    this.defaults = defaults;
    const dir = join(app.getPath("userData"), "storage");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, filename);
  }
  filePath;
  read() {
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      this.write(this.defaults);
      return this.defaults;
    }
  }
  write(data) {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
const CHANNELS = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE"
};
const store = new FileStore("state.json", {
  root: { id: "root", name: "Root", children: [] },
  sharedSteps: []
});
function registerHandlers(ipcMain2) {
  ipcMain2.handle(CHANNELS.LOAD_STATE, (_e, fallback) => {
    try {
      return store.read();
    } catch {
      return fallback;
    }
  });
  ipcMain2.handle(CHANNELS.SAVE_STATE, (_e, state) => {
    store.write(state);
    return true;
  });
}
let win = null;
async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    try {
      await win.loadURL(devUrl);
      win.webContents.openDevTools({ mode: "detach" });
    } catch (err) {
      console.error("Failed to load renderer dev URL:", devUrl, err);
      await win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
  } else {
    await win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}
app.whenReady().then(() => {
  registerHandlers(ipcMain);
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//# sourceMappingURL=main.mjs.map
