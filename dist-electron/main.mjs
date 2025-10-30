import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { promises } from "fs";
import { randomUUID } from "crypto";
import keytar from "keytar";
const CHANNELS = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET"
};
function getBaseDir$1() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd();
}
const REPO_DIR = "tests_repo";
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function isTestFolder(dirPath, entries) {
  return entries.includes("test.json");
}
async function ensureDir$1(p) {
  await promises.mkdir(p, { recursive: true });
}
async function loadFromFs() {
  const base = path.join(getBaseDir$1(), REPO_DIR);
  await ensureDir$1(base);
  const rootDir = path.join(base, "root");
  await ensureDir$1(rootDir);
  async function readNode(dir) {
    const entries = await promises.readdir(dir);
    if (isTestFolder(dir, entries)) {
      const raw = await promises.readFile(path.join(dir, "test.json"), "utf-8");
      return JSON.parse(raw);
    }
    const folder = { id: randomUUID(), name: path.basename(dir), children: [] };
    for (const name of entries) {
      const childPath = path.join(dir, name);
      const stat = await promises.lstat(childPath);
      if (stat.isDirectory()) {
        folder.children.push(await readNode(childPath));
      }
    }
    return folder;
  }
  const root = await readNode(rootDir);
  return { root, sharedSteps: [] };
}
async function saveToFs(state) {
  const base = path.join(getBaseDir$1(), REPO_DIR);
  await ensureDir$1(base);
  const rootDir = path.join(base, "root");
  await ensureDir$1(rootDir);
  async function writeFolder(fsDir, folder) {
    await ensureDir$1(fsDir);
    const desired = /* @__PURE__ */ new Map();
    for (const child of folder.children) {
      if ("children" in child) {
        const target = path.join(fsDir, child.name);
        desired.set(target, { node: child, targetPath: target });
      } else {
        const slug = slugify(child.name);
        const idSuffix = child.id?.slice(0, 6) ?? randomUUID().slice(0, 6);
        const target = path.join(fsDir, `${slug}__${idSuffix}`);
        desired.set(target, { node: child, targetPath: target });
      }
    }
    for (const { node, targetPath } of desired.values()) {
      if ("children" in node) {
        await writeFolder(targetPath, node);
      } else {
        await ensureDir$1(targetPath);
        await ensureDir$1(path.join(targetPath, "attachments"));
        await promises.writeFile(path.join(targetPath, "test.json"), JSON.stringify(node, null, 2), "utf-8");
      }
    }
    const current = await promises.readdir(fsDir);
    for (const name of current) {
      const p = path.join(fsDir, name);
      if (!(await promises.lstat(p)).isDirectory()) continue;
      if (!desired.has(p)) {
        await promises.rm(p, { recursive: true, force: true });
      }
    }
  }
  await writeFolder(rootDir, state.root);
}
const SERVICE = "testshub-atlassian";
function getBaseDir() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd();
}
const SETTINGS_PATH = path.join(getBaseDir(), "tests_repo", ".settings.json");
async function ensureDir(filePath) {
  await promises.mkdir(path.dirname(filePath), { recursive: true });
}
async function loadSettings() {
  try {
    const raw = await promises.readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const login = parsed.login ?? "";
    const baseUrl = parsed.baseUrl ?? "";
    const hasSecret = login ? !!await keytar.getPassword(SERVICE, login) : false;
    return { login, baseUrl, hasSecret };
  } catch {
    return { login: "", baseUrl: "", hasSecret: false };
  }
}
async function saveSettings(login, passwordOrToken, baseUrl) {
  await ensureDir(SETTINGS_PATH);
  const filePayload = { login, baseUrl };
  await promises.writeFile(SETTINGS_PATH, JSON.stringify(filePayload, null, 2), "utf-8");
  if (login && typeof passwordOrToken === "string" && passwordOrToken.length > 0) {
    await keytar.setPassword(SERVICE, login, passwordOrToken);
  }
  const hasSecret = login ? !!await keytar.getPassword(SERVICE, login) : false;
  return { login, baseUrl: baseUrl ?? "", hasSecret };
}
async function getAtlassianSecret(login) {
  if (!login) return null;
  return await keytar.getPassword(SERVICE, login);
}
function registerHandlers(ipcMain2) {
  ipcMain2.handle(CHANNELS.LOAD_STATE, async (_e, fallback) => {
    try {
      return await loadFromFs();
    } catch {
      return fallback;
    }
  });
  ipcMain2.handle(CHANNELS.SAVE_STATE, async (_e, state) => {
    await saveToFs(state);
    return true;
  });
  ipcMain2.handle(CHANNELS.LOAD_SETTINGS, async () => {
    return await loadSettings();
  });
  ipcMain2.handle(
    CHANNELS.SAVE_SETTINGS,
    async (_e, payload) => {
      return await saveSettings(payload.login, payload.passwordOrToken, payload.baseUrl);
    }
  );
  ipcMain2.handle(
    CHANNELS.GET_ATLASSIAN_SECRET,
    async (_e, payload) => {
      const s = await getAtlassianSecret(payload.login);
      return s ?? "";
    }
  );
}
let win = null;
async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const devUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  {
    try {
      await win.loadURL(devUrl);
      win.webContents.openDevTools({ mode: "detach" });
    } catch (err) {
      console.error("Failed to load renderer dev URL:", devUrl, err);
      await win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
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
