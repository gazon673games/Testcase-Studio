import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { promises } from "fs";
import crypto, { randomUUID } from "crypto";
import keytar from "keytar";
const CHANNELS = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET",
  ZEPHYR_GET_TESTCASE: "ZEPHYR_GET_TESTCASE",
  ZEPHYR_SEARCH_TESTCASES: "ZEPHYR_SEARCH_TESTCASES",
  ZEPHYR_UPSERT_TESTCASE: "ZEPHYR_UPSERT_TESTCASE",
  WRITE_STATE_SNAPSHOT: "WRITE_STATE_SNAPSHOT",
  WRITE_PUBLISH_LOG: "WRITE_PUBLISH_LOG"
};
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
const native = {
  randomUUID: crypto.randomUUID
};
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
function nowISO() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function toOptionalString(value) {
  if (typeof value !== "string") return value == null ? void 0 : String(value);
  const next = value.trim();
  return next.length ? next : void 0;
}
function toOptionalBoolean(value) {
  return typeof value === "boolean" ? value : void 0;
}
function ensureId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : v4();
}
function normalizeIso(value) {
  return typeof value === "string" && value.trim() ? value : nowISO();
}
function normalizeAttachmentEntry(value) {
  if (!value || typeof value !== "object") return null;
  const name = typeof value.name === "string" ? value.name : "attachment";
  const pathOrDataUrl = typeof value.pathOrDataUrl === "string" ? value.pathOrDataUrl : typeof value.path === "string" ? value.path : "";
  if (!name && !pathOrDataUrl) return null;
  return {
    id: ensureId(value.id),
    name,
    pathOrDataUrl
  };
}
function attachmentKey(value) {
  if (value && typeof value.id === "string" && value.id.trim()) return `id:${value.id.trim()}`;
  const name = typeof value?.name === "string" ? value.name : "";
  const pathOrDataUrl = typeof value?.pathOrDataUrl === "string" ? value.pathOrDataUrl : typeof value?.path === "string" ? value.path : "";
  return `path:${name}::${pathOrDataUrl}`;
}
function normalizeAttachments(values) {
  const out = /* @__PURE__ */ new Map();
  for (const value of values) {
    const normalized = normalizeAttachmentEntry(value);
    if (!normalized) continue;
    out.set(attachmentKey(value), normalized);
  }
  return [...out.values()];
}
function normalizePartItem(value) {
  return {
    id: ensureId(value?.id),
    text: typeof value?.text === "string" ? value.text : "",
    export: toOptionalBoolean(value?.export)
  };
}
function normalizeSubStep(value) {
  return {
    id: ensureId(value?.id),
    title: toOptionalString(value?.title),
    text: toOptionalString(value?.text)
  };
}
function normalizeLinks(values) {
  const out = [];
  for (const value of values) {
    const provider = value && typeof value === "object" ? value.provider : void 0;
    const externalId = value && typeof value === "object" ? value.externalId : void 0;
    if ((provider === "zephyr" || provider === "allure") && typeof externalId === "string" && externalId.trim()) {
      out.push({ provider, externalId: externalId.trim() });
    }
  }
  return out;
}
function normalizeParams(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw == null) continue;
    out[key] = typeof raw === "string" ? raw : String(raw);
  }
  return out;
}
function normalizeMeta(value) {
  return {
    tags: Array.isArray(value?.tags) ? value.tags.map((tag) => String(tag)) : [],
    params: normalizeParams(value?.params),
    objective: toOptionalString(value?.objective),
    preconditions: toOptionalString(value?.preconditions),
    status: toOptionalString(value?.status),
    priority: toOptionalString(value?.priority),
    component: toOptionalString(value?.component),
    owner: toOptionalString(value?.owner),
    folder: toOptionalString(value?.folder),
    estimated: toOptionalString(value?.estimated),
    testType: toOptionalString(value?.testType),
    automation: toOptionalString(value?.automation),
    assignedTo: toOptionalString(value?.assignedTo)
  };
}
function normalizeStep(step) {
  const source = step ?? {};
  const legacyAttachments = Array.isArray(source?.internal?.meta?.attachments) ? source.internal.meta.attachments : [];
  const providerStepId = toOptionalString(
    source.raw?.providerStepId ?? source?.providerStepId ?? source?.internal?.meta?.providerStepId
  );
  const rawMeta = source.internal && typeof source.internal === "object" && source.internal.meta && typeof source.internal.meta === "object" ? { ...source.internal.meta } : void 0;
  if (rawMeta && "attachments" in rawMeta) delete rawMeta.attachments;
  return {
    id: ensureId(source.id),
    action: toOptionalString(source.action),
    data: toOptionalString(source.data),
    expected: toOptionalString(source.expected),
    text: toOptionalString(source.text) ?? toOptionalString(source.action) ?? "",
    raw: {
      action: toOptionalString(source.raw?.action) ?? toOptionalString(source.action),
      data: toOptionalString(source.raw?.data) ?? toOptionalString(source.data),
      expected: toOptionalString(source.raw?.expected) ?? toOptionalString(source.expected),
      ...providerStepId ? { providerStepId } : {}
    },
    subSteps: Array.isArray(source.subSteps) ? source.subSteps.map(normalizeSubStep) : [],
    internal: {
      note: toOptionalString(source.internal?.note),
      url: toOptionalString(source.internal?.url),
      meta: rawMeta && Object.keys(rawMeta).length ? rawMeta : void 0,
      parts: {
        action: Array.isArray(source.internal?.parts?.action) ? source.internal.parts.action.map(normalizePartItem) : [],
        data: Array.isArray(source.internal?.parts?.data) ? source.internal.parts.data.map(normalizePartItem) : [],
        expected: Array.isArray(source.internal?.parts?.expected) ? source.internal.parts.expected.map(normalizePartItem) : []
      }
    },
    usesShared: toOptionalString(source.usesShared),
    attachments: normalizeAttachments([
      ...Array.isArray(source.attachments) ? source.attachments : [],
      ...legacyAttachments
    ])
  };
}
function normalizeTestCase(test) {
  const source = test ?? {};
  return {
    id: ensureId(source.id),
    name: typeof source.name === "string" && source.name.trim() ? source.name : "Untitled Test",
    description: toOptionalString(source.description) ?? "",
    steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
    attachments: normalizeAttachments(Array.isArray(source.attachments) ? source.attachments : []),
    links: normalizeLinks(Array.isArray(source.links) ? source.links : []),
    updatedAt: normalizeIso(source.updatedAt),
    meta: normalizeMeta(source.meta),
    exportCfg: {
      enabled: typeof source.exportCfg?.enabled === "boolean" ? source.exportCfg.enabled : true
    }
  };
}
function normalizeNode(node) {
  return Array.isArray(node?.children) ? normalizeFolder(node, toOptionalString(node?.name) ?? "Folder") : normalizeTestCase(node);
}
function normalizeFolder(folder, fallbackName = "Folder") {
  const source = folder ?? {};
  return {
    id: ensureId(source.id),
    name: typeof source.name === "string" && source.name.trim() ? source.name : fallbackName,
    children: Array.isArray(source.children) ? source.children.map(normalizeNode) : []
  };
}
function normalizeSharedStep(shared) {
  const source = shared ?? {};
  return {
    id: ensureId(source.id),
    name: typeof source.name === "string" && source.name.trim() ? source.name : "Shared Step",
    steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
    updatedAt: normalizeIso(source.updatedAt)
  };
}
function normalizeRootState(state) {
  const source = state ?? {};
  return {
    root: normalizeFolder(source.root, "Root"),
    sharedSteps: Array.isArray(source.sharedSteps) ? source.sharedSteps.map(normalizeSharedStep) : []
  };
}
const REPO_DIR = "tests_repo";
const ROOT_DIR = "root";
const FOLDER_META_FILE = "folder.json";
const SHARED_STEPS_FILE = "shared_steps.json";
const SNAPSHOTS_DIR = ".snapshots";
const PUBLISH_LOGS_DIR = ".publish-logs";
function getBaseDir$1() {
  return app.isPackaged ? path.dirname(app.getPath("exe")) : process.cwd();
}
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function isTestFolder(entries) {
  return entries.includes("test.json");
}
async function ensureDir$1(targetPath) {
  await promises.mkdir(targetPath, { recursive: true });
}
async function readJsonFile(filePath) {
  try {
    const raw = await promises.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function readFolderMeta(dir) {
  return readJsonFile(path.join(dir, FOLDER_META_FILE));
}
async function loadSharedSteps(baseDir) {
  const raw = await readJsonFile(path.join(baseDir, SHARED_STEPS_FILE));
  return Array.isArray(raw) ? raw.map(normalizeSharedStep) : [];
}
async function loadFromFs() {
  const baseDir = path.join(getBaseDir$1(), REPO_DIR);
  const rootDir = path.join(baseDir, ROOT_DIR);
  await ensureDir$1(rootDir);
  async function readNode(dir, fallbackName) {
    const entries = await promises.readdir(dir);
    if (isTestFolder(entries)) {
      const raw = await promises.readFile(path.join(dir, "test.json"), "utf-8");
      return normalizeTestCase(JSON.parse(raw));
    }
    const meta = await readFolderMeta(dir);
    const folder = {
      id: typeof meta?.id === "string" && meta.id.trim() ? meta.id : randomUUID(),
      name: typeof meta?.name === "string" && meta.name.trim() ? meta.name : fallbackName,
      children: []
    };
    for (const entry of entries) {
      const childPath = path.join(dir, entry);
      const stat = await promises.lstat(childPath);
      if (!stat.isDirectory()) continue;
      folder.children.push(await readNode(childPath, entry));
    }
    return folder;
  }
  const root = await readNode(rootDir, "Root");
  const sharedSteps = await loadSharedSteps(baseDir);
  return normalizeRootState({ root, sharedSteps });
}
async function saveToFs(state) {
  const normalized = normalizeRootState(state);
  const baseDir = path.join(getBaseDir$1(), REPO_DIR);
  const rootDir = path.join(baseDir, ROOT_DIR);
  await ensureDir$1(rootDir);
  async function writeFolder(fsDir, folder) {
    await ensureDir$1(fsDir);
    await promises.writeFile(
      path.join(fsDir, FOLDER_META_FILE),
      JSON.stringify({ id: folder.id, name: folder.name }, null, 2),
      "utf-8"
    );
    const desired = /* @__PURE__ */ new Map();
    for (const child of folder.children) {
      if ("children" in child) {
        desired.set(path.join(fsDir, child.name), { node: child });
        continue;
      }
      const slug = slugify(child.name);
      const idSuffix = child.id?.slice(0, 6) ?? randomUUID().slice(0, 6);
      desired.set(path.join(fsDir, `${slug}__${idSuffix}`), { node: child });
    }
    for (const [targetPath, entry] of desired.entries()) {
      if ("children" in entry.node) {
        await writeFolder(targetPath, entry.node);
      } else {
        await ensureDir$1(targetPath);
        await ensureDir$1(path.join(targetPath, "attachments"));
        await promises.writeFile(
          path.join(targetPath, "test.json"),
          JSON.stringify(normalizeTestCase(entry.node), null, 2),
          "utf-8"
        );
      }
    }
    const current = await promises.readdir(fsDir);
    for (const entry of current) {
      const currentPath = path.join(fsDir, entry);
      const stat = await promises.lstat(currentPath);
      if (!stat.isDirectory()) continue;
      if (!desired.has(currentPath)) {
        await promises.rm(currentPath, { recursive: true, force: true });
      }
    }
  }
  await writeFolder(rootDir, normalized.root);
  await promises.writeFile(
    path.join(baseDir, SHARED_STEPS_FILE),
    JSON.stringify(normalized.sharedSteps, null, 2),
    "utf-8"
  );
}
async function writeStateSnapshot(state, kind = "snapshot", meta) {
  const normalized = normalizeRootState(state);
  const baseDir = path.join(getBaseDir$1(), REPO_DIR, SNAPSHOTS_DIR);
  await ensureDir$1(baseDir);
  const filePath = path.join(baseDir, `${kind}-${timestampLabel()}.json`);
  await promises.writeFile(
    filePath,
    JSON.stringify({ createdAt: (/* @__PURE__ */ new Date()).toISOString(), kind, meta: meta ?? {}, state: normalized }, null, 2),
    "utf-8"
  );
  return filePath;
}
async function writePublishLog(payload) {
  const baseDir = path.join(getBaseDir$1(), REPO_DIR, PUBLISH_LOGS_DIR);
  await ensureDir$1(baseDir);
  const filePath = path.join(baseDir, `publish-${timestampLabel()}.json`);
  await promises.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return filePath;
}
function timestampLabel() {
  const now = /* @__PURE__ */ new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("-");
  return `${date}-${time}`;
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
function cleanBaseUrl(u) {
  return (u || "").replace(/\/+$/, "");
}
function b64(s) {
  return Buffer.from(s, "utf8").toString("base64");
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
  ipcMain2.handle(CHANNELS.WRITE_STATE_SNAPSHOT, async (_e, payload) => {
    return await writeStateSnapshot(payload.state, payload.kind, payload.meta);
  });
  ipcMain2.handle(CHANNELS.WRITE_PUBLISH_LOG, async (_e, payload) => {
    return await writePublishLog(payload);
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
  ipcMain2.handle(
    CHANNELS.ZEPHYR_GET_TESTCASE,
    async (_e, payload) => {
      const settings = await loadSettings();
      const login = settings.login || "";
      const baseUrl = cleanBaseUrl(settings.baseUrl || "");
      if (!login) throw new Error("Atlassian login is empty in settings");
      if (!baseUrl) throw new Error("Atlassian baseUrl is empty in settings");
      const password = await getAtlassianSecret(login) || "";
      if (!password) throw new Error("Atlassian password is not stored in keychain");
      const url = `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(payload.ref)}`;
      const auth = `Basic ${b64(`${login}:${password}`)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: auth, Accept: "application/json" }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Zephyr(${payload.by}) ${res.status} ${res.statusText}` + (text ? ` – ${text.slice(0, 300)}` : "")
        );
      }
      return await res.json();
    }
  );
  ipcMain2.handle(
    CHANNELS.ZEPHYR_SEARCH_TESTCASES,
    async (_e, payload) => {
      const settings = await loadSettings();
      const login = settings.login || "";
      const baseUrl = cleanBaseUrl(settings.baseUrl || "");
      if (!login) throw new Error("Atlassian login is empty in settings");
      if (!baseUrl) throw new Error("Atlassian baseUrl is empty in settings");
      const password = await getAtlassianSecret(login) || "";
      if (!password) throw new Error("Atlassian password is not stored in keychain");
      const query = String(payload.query ?? "").trim();
      if (!query) throw new Error("Zephyr search query is empty");
      const url = new URL(`${baseUrl}/rest/atm/1.0/testcase/search`);
      url.searchParams.set("query", query);
      url.searchParams.set("startAt", String(Math.max(0, Number(payload.startAt ?? 0) || 0)));
      url.searchParams.set("maxResults", String(Math.max(1, Number(payload.maxResults ?? 100) || 100)));
      const auth = `Basic ${b64(`${login}:${password}`)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: auth, Accept: "application/json" }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Zephyr(search) ${res.status} ${res.statusText}` + (text ? ` – ${text.slice(0, 300)}` : "")
        );
      }
      return await res.json();
    }
  );
  ipcMain2.handle(
    CHANNELS.ZEPHYR_UPSERT_TESTCASE,
    async (_e, payload) => {
      const settings = await loadSettings();
      const login = settings.login || "";
      const baseUrl = cleanBaseUrl(settings.baseUrl || "");
      if (!login) throw new Error("Atlassian login is empty in settings");
      if (!baseUrl) throw new Error("Atlassian baseUrl is empty in settings");
      const password = await getAtlassianSecret(login) || "";
      if (!password) throw new Error("Atlassian password is not stored in keychain");
      const ref = typeof payload.ref === "string" && payload.ref.trim() ? payload.ref.trim() : "";
      const url = ref ? `${baseUrl}/rest/atm/1.0/testcase/${encodeURIComponent(ref)}` : `${baseUrl}/rest/atm/1.0/testcase`;
      const auth = `Basic ${b64(`${login}:${password}`)}`;
      const res = await fetch(url, {
        method: ref ? "PUT" : "POST",
        headers: {
          Authorization: auth,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload.body ?? {})
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Zephyr(upsert) ${res.status} ${res.statusText}` + (text ? ` – ${text.slice(0, 400)}` : "")
        );
      }
      return await res.json().catch(() => ({}));
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
