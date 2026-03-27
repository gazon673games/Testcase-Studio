import { app as f, BrowserWindow as F, ipcMain as W } from "electron";
import c from "node:path";
import { promises as m } from "fs";
import N, { randomUUID as $ } from "crypto";
import _ from "keytar";
const w = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET",
  ZEPHYR_GET_TESTCASE: "ZEPHYR_GET_TESTCASE",
  ZEPHYR_SEARCH_TESTCASES: "ZEPHYR_SEARCH_TESTCASES"
}, T = new Uint8Array(256);
let g = T.length;
function K() {
  return g > T.length - 16 && (N.randomFillSync(T), g = 0), T.slice(g, g += 16);
}
const l = [];
for (let t = 0; t < 256; ++t)
  l.push((t + 256).toString(16).slice(1));
function Q(t, e = 0) {
  return l[t[e + 0]] + l[t[e + 1]] + l[t[e + 2]] + l[t[e + 3]] + "-" + l[t[e + 4]] + l[t[e + 5]] + "-" + l[t[e + 6]] + l[t[e + 7]] + "-" + l[t[e + 8]] + l[t[e + 9]] + "-" + l[t[e + 10]] + l[t[e + 11]] + l[t[e + 12]] + l[t[e + 13]] + l[t[e + 14]] + l[t[e + 15]];
}
const P = {
  randomUUID: N.randomUUID
};
function X(t, e, n) {
  if (P.randomUUID && !t)
    return P.randomUUID();
  t = t || {};
  const r = t.random || (t.rng || K)();
  return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, Q(r);
}
function v() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function a(t) {
  if (typeof t != "string") return t == null ? void 0 : String(t);
  const e = t.trim();
  return e.length ? e : void 0;
}
function tt(t) {
  return typeof t == "boolean" ? t : void 0;
}
function S(t) {
  return typeof t == "string" && t.trim() ? t.trim() : X();
}
function C(t) {
  return typeof t == "string" && t.trim() ? t : v();
}
function et(t) {
  if (!t || typeof t != "object") return null;
  const e = typeof t.name == "string" ? t.name : "attachment", n = typeof t.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t.path == "string" ? t.path : "";
  return !e && !n ? null : {
    id: S(t.id),
    name: e,
    pathOrDataUrl: n
  };
}
function nt(t) {
  if (t && typeof t.id == "string" && t.id.trim()) return `id:${t.id.trim()}`;
  const e = typeof t?.name == "string" ? t.name : "", n = typeof t?.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t?.path == "string" ? t.path : "";
  return `path:${e}::${n}`;
}
function z(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t) {
    const r = et(n);
    r && e.set(nt(n), r);
  }
  return [...e.values()];
}
function b(t) {
  return {
    id: S(t?.id),
    text: typeof t?.text == "string" ? t.text : "",
    export: tt(t?.export)
  };
}
function rt(t) {
  return {
    id: S(t?.id),
    title: a(t?.title),
    text: a(t?.text)
  };
}
function at(t) {
  const e = [];
  for (const n of t) {
    const r = n && typeof n == "object" ? n.provider : void 0, i = n && typeof n == "object" ? n.externalId : void 0;
    (r === "zephyr" || r === "allure") && typeof i == "string" && i.trim() && e.push({ provider: r, externalId: i.trim() });
  }
  return e;
}
function it(t) {
  if (!t || typeof t != "object") return {};
  const e = {};
  for (const [n, r] of Object.entries(t))
    r != null && (e[n] = typeof r == "string" ? r : String(r));
  return e;
}
function st(t) {
  return {
    tags: Array.isArray(t?.tags) ? t.tags.map((e) => String(e)) : [],
    params: it(t?.params),
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
  const e = t ?? {}, n = Array.isArray(e?.internal?.meta?.attachments) ? e.internal.meta.attachments : [], r = a(
    e.raw?.providerStepId ?? e?.providerStepId ?? e?.internal?.meta?.providerStepId
  ), i = e.internal && typeof e.internal == "object" && e.internal.meta && typeof e.internal.meta == "object" ? { ...e.internal.meta } : void 0;
  return i && "attachments" in i && delete i.attachments, {
    id: S(e.id),
    action: a(e.action),
    data: a(e.data),
    expected: a(e.expected),
    text: a(e.text) ?? a(e.action) ?? "",
    raw: {
      action: a(e.raw?.action) ?? a(e.action),
      data: a(e.raw?.data) ?? a(e.data),
      expected: a(e.raw?.expected) ?? a(e.expected),
      ...r ? { providerStepId: r } : {}
    },
    subSteps: Array.isArray(e.subSteps) ? e.subSteps.map(rt) : [],
    internal: {
      note: a(e.internal?.note),
      url: a(e.internal?.url),
      meta: i && Object.keys(i).length ? i : void 0,
      parts: {
        action: Array.isArray(e.internal?.parts?.action) ? e.internal.parts.action.map(b) : [],
        data: Array.isArray(e.internal?.parts?.data) ? e.internal.parts.data.map(b) : [],
        expected: Array.isArray(e.internal?.parts?.expected) ? e.internal.parts.expected.map(b) : []
      }
    },
    usesShared: a(e.usesShared),
    attachments: z([
      ...Array.isArray(e.attachments) ? e.attachments : [],
      ...n
    ])
  };
}
function R(t) {
  const e = t ?? {};
  return {
    id: S(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : "Untitled Test",
    description: a(e.description) ?? "",
    steps: Array.isArray(e.steps) ? e.steps.map(L) : [],
    attachments: z(Array.isArray(e.attachments) ? e.attachments : []),
    links: at(Array.isArray(e.links) ? e.links : []),
    updatedAt: C(e.updatedAt),
    meta: st(e.meta),
    exportCfg: {
      enabled: typeof e.exportCfg?.enabled == "boolean" ? e.exportCfg.enabled : !0
    }
  };
}
function ot(t) {
  return Array.isArray(t?.children) ? G(t, a(t?.name) ?? "Folder") : R(t);
}
function G(t, e = "Folder") {
  const n = t ?? {};
  return {
    id: S(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : e,
    children: Array.isArray(n.children) ? n.children.map(ot) : []
  };
}
function k(t) {
  const e = t ?? {};
  return {
    id: S(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : "Shared Step",
    steps: Array.isArray(e.steps) ? e.steps.map(L) : [],
    updatedAt: C(e.updatedAt)
  };
}
function H(t) {
  const e = t ?? {};
  return {
    root: G(e.root, "Root"),
    sharedSteps: Array.isArray(e.sharedSteps) ? e.sharedSteps.map(k) : []
  };
}
const Z = "tests_repo", B = "root", J = "folder.json", V = "shared_steps.json";
function Y() {
  return f.isPackaged ? c.dirname(f.getPath("exe")) : process.cwd();
}
function ct(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function dt(t) {
  return t.includes("test.json");
}
async function A(t) {
  await m.mkdir(t, { recursive: !0 });
}
async function q(t) {
  try {
    const e = await m.readFile(t, "utf-8");
    return JSON.parse(e);
  } catch {
    return null;
  }
}
async function lt(t) {
  return q(c.join(t, J));
}
async function pt(t) {
  const e = await q(c.join(t, V));
  return Array.isArray(e) ? e.map(k) : [];
}
async function mt() {
  const t = c.join(Y(), Z), e = c.join(t, B);
  await A(e);
  async function n(d, h) {
    const u = await m.readdir(d);
    if (dt(u)) {
      const o = await m.readFile(c.join(d, "test.json"), "utf-8");
      return R(JSON.parse(o));
    }
    const p = await lt(d), s = {
      id: typeof p?.id == "string" && p.id.trim() ? p.id : $(),
      name: typeof p?.name == "string" && p.name.trim() ? p.name : h,
      children: []
    };
    for (const o of u) {
      const y = c.join(d, o);
      (await m.lstat(y)).isDirectory() && s.children.push(await n(y, o));
    }
    return s;
  }
  const r = await n(e, "Root"), i = await pt(t);
  return H({ root: r, sharedSteps: i });
}
async function ut(t) {
  const e = H(t), n = c.join(Y(), Z), r = c.join(n, B);
  await A(r);
  async function i(d, h) {
    await A(d), await m.writeFile(
      c.join(d, J),
      JSON.stringify({ id: h.id, name: h.name }, null, 2),
      "utf-8"
    );
    const u = /* @__PURE__ */ new Map();
    for (const s of h.children) {
      if ("children" in s) {
        u.set(c.join(d, s.name), { node: s });
        continue;
      }
      const o = ct(s.name), y = s.id?.slice(0, 6) ?? $().slice(0, 6);
      u.set(c.join(d, `${o}__${y}`), { node: s });
    }
    for (const [s, o] of u.entries())
      "children" in o.node ? await i(s, o.node) : (await A(s), await A(c.join(s, "attachments")), await m.writeFile(
        c.join(s, "test.json"),
        JSON.stringify(R(o.node), null, 2),
        "utf-8"
      ));
    const p = await m.readdir(d);
    for (const s of p) {
      const o = c.join(d, s);
      (await m.lstat(o)).isDirectory() && (u.has(o) || await m.rm(o, { recursive: !0, force: !0 }));
    }
  }
  await i(r, e.root), await m.writeFile(
    c.join(n, V),
    JSON.stringify(e.sharedSteps, null, 2),
    "utf-8"
  );
}
const x = "testshub-atlassian";
function ht() {
  return f.isPackaged ? c.dirname(f.getPath("exe")) : process.cwd();
}
const U = c.join(ht(), "tests_repo", ".settings.json");
async function ft(t) {
  await m.mkdir(c.dirname(t), { recursive: !0 });
}
async function j() {
  try {
    const t = await m.readFile(U, "utf-8"), e = JSON.parse(t), n = e.login ?? "", r = e.baseUrl ?? "", i = n ? !!await _.getPassword(x, n) : !1;
    return { login: n, baseUrl: r, hasSecret: i };
  } catch {
    return { login: "", baseUrl: "", hasSecret: !1 };
  }
}
async function yt(t, e, n) {
  await ft(U);
  const r = { login: t, baseUrl: n };
  await m.writeFile(U, JSON.stringify(r, null, 2), "utf-8"), t && typeof e == "string" && e.length > 0 && await _.setPassword(x, t, e);
  const i = t ? !!await _.getPassword(x, t) : !1;
  return { login: t, baseUrl: n ?? "", hasSecret: i };
}
async function I(t) {
  return t ? await _.getPassword(x, t) : null;
}
function D(t) {
  return (t || "").replace(/\/+$/, "");
}
function O(t) {
  return Buffer.from(t, "utf8").toString("base64");
}
function wt(t) {
  t.handle(w.LOAD_STATE, async (e, n) => {
    try {
      return await mt();
    } catch {
      return n;
    }
  }), t.handle(w.SAVE_STATE, async (e, n) => (await ut(n), !0)), t.handle(w.LOAD_SETTINGS, async () => await j()), t.handle(
    w.SAVE_SETTINGS,
    async (e, n) => await yt(n.login, n.passwordOrToken, n.baseUrl)
  ), t.handle(
    w.GET_ATLASSIAN_SECRET,
    async (e, n) => await I(n.login) ?? ""
  ), t.handle(
    w.ZEPHYR_GET_TESTCASE,
    async (e, n) => {
      const r = await j(), i = r.login || "", d = D(r.baseUrl || "");
      if (!i) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const h = await I(i) || "";
      if (!h) throw new Error("Atlassian password is not stored in keychain");
      const u = `${d}/rest/atm/1.0/testcase/${encodeURIComponent(n.ref)}`, p = `Basic ${O(`${i}:${h}`)}`, s = await fetch(u, {
        method: "GET",
        headers: { Authorization: p, Accept: "application/json" }
      });
      if (!s.ok) {
        const o = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(${n.by}) ${s.status} ${s.statusText}` + (o ? ` – ${o.slice(0, 300)}` : "")
        );
      }
      return await s.json();
    }
  ), t.handle(
    w.ZEPHYR_SEARCH_TESTCASES,
    async (e, n) => {
      const r = await j(), i = r.login || "", d = D(r.baseUrl || "");
      if (!i) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const h = await I(i) || "";
      if (!h) throw new Error("Atlassian password is not stored in keychain");
      const u = String(n.query ?? "").trim();
      if (!u) throw new Error("Zephyr search query is empty");
      const p = new URL(`${d}/rest/atm/1.0/testcase/search`);
      p.searchParams.set("query", u), p.searchParams.set("startAt", String(Math.max(0, Number(n.startAt ?? 0) || 0))), p.searchParams.set("maxResults", String(Math.max(1, Number(n.maxResults ?? 100) || 100)));
      const s = `Basic ${O(`${i}:${h}`)}`, o = await fetch(p, {
        method: "GET",
        headers: { Authorization: s, Accept: "application/json" }
      });
      if (!o.ok) {
        const y = await o.text().catch(() => "");
        throw new Error(
          `Zephyr(search) ${o.status} ${o.statusText}` + (y ? ` – ${y.slice(0, 300)}` : "")
        );
      }
      return await o.json();
    }
  );
}
let E = null;
async function M() {
  E = new F({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: c.join(f.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const t = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  try {
    await E.loadURL(t), E.webContents.openDevTools({ mode: "detach" });
  } catch (e) {
    console.error("Failed to load renderer dev URL:", t, e), await E.loadFile(c.join(f.getAppPath(), "dist", "index.html"));
  }
}
f.whenReady().then(() => {
  wt(W), M();
});
f.on("window-all-closed", () => {
  process.platform !== "darwin" && f.quit();
});
f.on("activate", () => {
  F.getAllWindows().length === 0 && M();
});
//# sourceMappingURL=main.mjs.map
