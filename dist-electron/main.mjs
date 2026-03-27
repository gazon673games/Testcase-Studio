import { app as m, BrowserWindow as F, ipcMain as Y } from "electron";
import s from "node:path";
import { promises as l } from "fs";
import P, { randomUUID as R } from "crypto";
import _ from "keytar";
const w = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET",
  ZEPHYR_GET_TESTCASE: "ZEPHYR_GET_TESTCASE"
}, T = new Uint8Array(256);
let g = T.length;
function M() {
  return g > T.length - 16 && (P.randomFillSync(T), g = 0), T.slice(g, g += 16);
}
const d = [];
for (let t = 0; t < 256; ++t)
  d.push((t + 256).toString(16).slice(1));
function q(t, n = 0) {
  return d[t[n + 0]] + d[t[n + 1]] + d[t[n + 2]] + d[t[n + 3]] + "-" + d[t[n + 4]] + d[t[n + 5]] + "-" + d[t[n + 6]] + d[t[n + 7]] + "-" + d[t[n + 8]] + d[t[n + 9]] + "-" + d[t[n + 10]] + d[t[n + 11]] + d[t[n + 12]] + d[t[n + 13]] + d[t[n + 14]] + d[t[n + 15]];
}
const U = {
  randomUUID: P.randomUUID
};
function K(t, n, e) {
  if (U.randomUUID && !t)
    return U.randomUUID();
  t = t || {};
  const r = t.random || (t.rng || M)();
  return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, q(r);
}
function Q() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function a(t) {
  if (typeof t != "string") return t == null ? void 0 : String(t);
  const n = t.trim();
  return n.length ? n : void 0;
}
function X(t) {
  return typeof t == "boolean" ? t : void 0;
}
function h(t) {
  return typeof t == "string" && t.trim() ? t.trim() : K();
}
function N(t) {
  return typeof t == "string" && t.trim() ? t : Q();
}
function v(t) {
  if (!t || typeof t != "object") return null;
  const n = typeof t.name == "string" ? t.name : "attachment", e = typeof t.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t.path == "string" ? t.path : "";
  return !n && !e ? null : {
    id: h(t.id),
    name: n,
    pathOrDataUrl: e
  };
}
function tt(t) {
  if (t && typeof t.id == "string" && t.id.trim()) return `id:${t.id.trim()}`;
  const n = typeof t?.name == "string" ? t.name : "", e = typeof t?.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t?.path == "string" ? t.path : "";
  return `path:${n}::${e}`;
}
function z(t) {
  const n = /* @__PURE__ */ new Map();
  for (const e of t) {
    const r = v(e);
    r && n.set(tt(e), r);
  }
  return [...n.values()];
}
function j(t) {
  return {
    id: h(t?.id),
    text: typeof t?.text == "string" ? t.text : "",
    export: X(t?.export)
  };
}
function nt(t) {
  return {
    id: h(t?.id),
    title: a(t?.title),
    text: a(t?.text)
  };
}
function et(t) {
  const n = [];
  for (const e of t) {
    const r = e && typeof e == "object" ? e.provider : void 0, i = e && typeof e == "object" ? e.externalId : void 0;
    (r === "zephyr" || r === "allure") && typeof i == "string" && i.trim() && n.push({ provider: r, externalId: i.trim() });
  }
  return n;
}
function rt(t) {
  if (!t || typeof t != "object") return {};
  const n = {};
  for (const [e, r] of Object.entries(t))
    r != null && (n[e] = typeof r == "string" ? r : String(r));
  return n;
}
function at(t) {
  return {
    tags: Array.isArray(t?.tags) ? t.tags.map((n) => String(n)) : [],
    params: rt(t?.params),
    objective: a(t?.objective),
    preconditions: a(t?.preconditions),
    status: a(t?.status),
    priority: a(t?.priority),
    component: a(t?.component),
    owner: a(t?.owner),
    folder: a(t?.folder),
    estimated: a(t?.estimated),
    testType: a(t?.testType),
    automation: a(t?.automation),
    assignedTo: a(t?.assignedTo)
  };
}
function L(t) {
  const n = t ?? {}, e = Array.isArray(n?.internal?.meta?.attachments) ? n.internal.meta.attachments : [], r = a(
    n.raw?.providerStepId ?? n?.providerStepId ?? n?.internal?.meta?.providerStepId
  ), i = n.internal && typeof n.internal == "object" && n.internal.meta && typeof n.internal.meta == "object" ? { ...n.internal.meta } : void 0;
  return i && "attachments" in i && delete i.attachments, {
    id: h(n.id),
    action: a(n.action),
    data: a(n.data),
    expected: a(n.expected),
    text: a(n.text) ?? a(n.action) ?? "",
    raw: {
      action: a(n.raw?.action) ?? a(n.action),
      data: a(n.raw?.data) ?? a(n.data),
      expected: a(n.raw?.expected) ?? a(n.expected),
      ...r ? { providerStepId: r } : {}
    },
    subSteps: Array.isArray(n.subSteps) ? n.subSteps.map(nt) : [],
    internal: {
      note: a(n.internal?.note),
      url: a(n.internal?.url),
      meta: i && Object.keys(i).length ? i : void 0,
      parts: {
        action: Array.isArray(n.internal?.parts?.action) ? n.internal.parts.action.map(j) : [],
        data: Array.isArray(n.internal?.parts?.data) ? n.internal.parts.data.map(j) : [],
        expected: Array.isArray(n.internal?.parts?.expected) ? n.internal.parts.expected.map(j) : []
      }
    },
    usesShared: a(n.usesShared),
    attachments: z([
      ...Array.isArray(n.attachments) ? n.attachments : [],
      ...e
    ])
  };
}
function I(t) {
  const n = t ?? {};
  return {
    id: h(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : "Untitled Test",
    description: a(n.description) ?? "",
    steps: Array.isArray(n.steps) ? n.steps.map(L) : [],
    attachments: z(Array.isArray(n.attachments) ? n.attachments : []),
    links: et(Array.isArray(n.links) ? n.links : []),
    updatedAt: N(n.updatedAt),
    meta: at(n.meta),
    exportCfg: {
      enabled: typeof n.exportCfg?.enabled == "boolean" ? n.exportCfg.enabled : !0
    }
  };
}
function it(t) {
  return Array.isArray(t?.children) ? $(t, a(t?.name) ?? "Folder") : I(t);
}
function $(t, n = "Folder") {
  const e = t ?? {};
  return {
    id: h(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : n,
    children: Array.isArray(e.children) ? e.children.map(it) : []
  };
}
function C(t) {
  const n = t ?? {};
  return {
    id: h(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : "Shared Step",
    steps: Array.isArray(n.steps) ? n.steps.map(L) : [],
    updatedAt: N(n.updatedAt)
  };
}
function G(t) {
  const n = t ?? {};
  return {
    root: $(n.root, "Root"),
    sharedSteps: Array.isArray(n.sharedSteps) ? n.sharedSteps.map(C) : []
  };
}
const k = "tests_repo", H = "root", J = "folder.json", B = "shared_steps.json";
function V() {
  return m.isPackaged ? s.dirname(m.getPath("exe")) : process.cwd();
}
function ot(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function st(t) {
  return t.includes("test.json");
}
async function A(t) {
  await l.mkdir(t, { recursive: !0 });
}
async function Z(t) {
  try {
    const n = await l.readFile(t, "utf-8");
    return JSON.parse(n);
  } catch {
    return null;
  }
}
async function ct(t) {
  return Z(s.join(t, J));
}
async function dt(t) {
  const n = await Z(s.join(t, B));
  return Array.isArray(n) ? n.map(C) : [];
}
async function pt() {
  const t = s.join(V(), k), n = s.join(t, H);
  await A(n);
  async function e(p, y) {
    const f = await l.readdir(p);
    if (st(f)) {
      const c = await l.readFile(s.join(p, "test.json"), "utf-8");
      return I(JSON.parse(c));
    }
    const u = await ct(p), o = {
      id: typeof u?.id == "string" && u.id.trim() ? u.id : R(),
      name: typeof u?.name == "string" && u.name.trim() ? u.name : y,
      children: []
    };
    for (const c of f) {
      const S = s.join(p, c);
      (await l.lstat(S)).isDirectory() && o.children.push(await e(S, c));
    }
    return o;
  }
  const r = await e(n, "Root"), i = await dt(t);
  return G({ root: r, sharedSteps: i });
}
async function lt(t) {
  const n = G(t), e = s.join(V(), k), r = s.join(e, H);
  await A(r);
  async function i(p, y) {
    await A(p), await l.writeFile(
      s.join(p, J),
      JSON.stringify({ id: y.id, name: y.name }, null, 2),
      "utf-8"
    );
    const f = /* @__PURE__ */ new Map();
    for (const o of y.children) {
      if ("children" in o) {
        f.set(s.join(p, o.name), { node: o });
        continue;
      }
      const c = ot(o.name), S = o.id?.slice(0, 6) ?? R().slice(0, 6);
      f.set(s.join(p, `${c}__${S}`), { node: o });
    }
    for (const [o, c] of f.entries())
      "children" in c.node ? await i(o, c.node) : (await A(o), await A(s.join(o, "attachments")), await l.writeFile(
        s.join(o, "test.json"),
        JSON.stringify(I(c.node), null, 2),
        "utf-8"
      ));
    const u = await l.readdir(p);
    for (const o of u) {
      const c = s.join(p, o);
      (await l.lstat(c)).isDirectory() && (f.has(c) || await l.rm(c, { recursive: !0, force: !0 }));
    }
  }
  await i(r, n.root), await l.writeFile(
    s.join(e, B),
    JSON.stringify(n.sharedSteps, null, 2),
    "utf-8"
  );
}
const x = "testshub-atlassian";
function ut() {
  return m.isPackaged ? s.dirname(m.getPath("exe")) : process.cwd();
}
const b = s.join(ut(), "tests_repo", ".settings.json");
async function mt(t) {
  await l.mkdir(s.dirname(t), { recursive: !0 });
}
async function D() {
  try {
    const t = await l.readFile(b, "utf-8"), n = JSON.parse(t), e = n.login ?? "", r = n.baseUrl ?? "", i = e ? !!await _.getPassword(x, e) : !1;
    return { login: e, baseUrl: r, hasSecret: i };
  } catch {
    return { login: "", baseUrl: "", hasSecret: !1 };
  }
}
async function ft(t, n, e) {
  await mt(b);
  const r = { login: t, baseUrl: e };
  await l.writeFile(b, JSON.stringify(r, null, 2), "utf-8"), t && typeof n == "string" && n.length > 0 && await _.setPassword(x, t, n);
  const i = t ? !!await _.getPassword(x, t) : !1;
  return { login: t, baseUrl: e ?? "", hasSecret: i };
}
async function O(t) {
  return t ? await _.getPassword(x, t) : null;
}
function yt(t) {
  return (t || "").replace(/\/+$/, "");
}
function ht(t) {
  return Buffer.from(t, "utf8").toString("base64");
}
function wt(t) {
  t.handle(w.LOAD_STATE, async (n, e) => {
    try {
      return await pt();
    } catch {
      return e;
    }
  }), t.handle(w.SAVE_STATE, async (n, e) => (await lt(e), !0)), t.handle(w.LOAD_SETTINGS, async () => await D()), t.handle(
    w.SAVE_SETTINGS,
    async (n, e) => await ft(e.login, e.passwordOrToken, e.baseUrl)
  ), t.handle(
    w.GET_ATLASSIAN_SECRET,
    async (n, e) => await O(e.login) ?? ""
  ), t.handle(
    w.ZEPHYR_GET_TESTCASE,
    async (n, e) => {
      const r = await D(), i = r.login || "", p = yt(r.baseUrl || "");
      if (!i) throw new Error("Atlassian login is empty in settings");
      if (!p) throw new Error("Atlassian baseUrl is empty in settings");
      const y = await O(i) || "";
      if (!y) throw new Error("Atlassian password is not stored in keychain");
      const f = `${p}/rest/atm/1.0/testcase/${encodeURIComponent(e.ref)}`, u = `Basic ${ht(`${i}:${y}`)}`, o = await fetch(f, {
        method: "GET",
        headers: { Authorization: u, Accept: "application/json" }
      });
      if (!o.ok) {
        const c = await o.text().catch(() => "");
        throw new Error(
          `Zephyr(${e.by}) ${o.status} ${o.statusText}` + (c ? ` – ${c.slice(0, 300)}` : "")
        );
      }
      return await o.json();
    }
  );
}
let E = null;
async function W() {
  E = new F({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: s.join(m.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const t = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  try {
    await E.loadURL(t), E.webContents.openDevTools({ mode: "detach" });
  } catch (n) {
    console.error("Failed to load renderer dev URL:", t, n), await E.loadFile(s.join(m.getAppPath(), "dist", "index.html"));
  }
}
m.whenReady().then(() => {
  wt(Y), W();
});
m.on("window-all-closed", () => {
  process.platform !== "darwin" && m.quit();
});
m.on("activate", () => {
  F.getAllWindows().length === 0 && W();
});
//# sourceMappingURL=main.mjs.map
