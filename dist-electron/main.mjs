import { app as w, BrowserWindow as F, ipcMain as K } from "electron";
import c from "node:path";
import { promises as m } from "fs";
import C, { randomUUID as H } from "crypto";
import j from "keytar";
const f = {
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
}, b = new Uint8Array(256);
let A = b.length;
function Q() {
  return A > b.length - 16 && (C.randomFillSync(b), A = 0), b.slice(A, A += 16);
}
const p = [];
for (let t = 0; t < 256; ++t)
  p.push((t + 256).toString(16).slice(1));
function X(t, n = 0) {
  return p[t[n + 0]] + p[t[n + 1]] + p[t[n + 2]] + p[t[n + 3]] + "-" + p[t[n + 4]] + p[t[n + 5]] + "-" + p[t[n + 6]] + p[t[n + 7]] + "-" + p[t[n + 8]] + p[t[n + 9]] + "-" + p[t[n + 10]] + p[t[n + 11]] + p[t[n + 12]] + p[t[n + 13]] + p[t[n + 14]] + p[t[n + 15]];
}
const L = {
  randomUUID: C.randomUUID
};
function v(t, n, e) {
  if (L.randomUUID && !t)
    return L.randomUUID();
  t = t || {};
  const r = t.random || (t.rng || Q)();
  return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, X(r);
}
function tt() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function i(t) {
  if (typeof t != "string") return t == null ? void 0 : String(t);
  const n = t.trim();
  return n.length ? n : void 0;
}
function nt(t) {
  return typeof t == "boolean" ? t : void 0;
}
function g(t) {
  return typeof t == "string" && t.trim() ? t.trim() : v();
}
function z(t) {
  return typeof t == "string" && t.trim() ? t : tt();
}
function et(t) {
  if (!t || typeof t != "object") return null;
  const n = typeof t.name == "string" ? t.name : "attachment", e = typeof t.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t.path == "string" ? t.path : "";
  return !n && !e ? null : {
    id: g(t.id),
    name: n,
    pathOrDataUrl: e
  };
}
function rt(t) {
  if (t && typeof t.id == "string" && t.id.trim()) return `id:${t.id.trim()}`;
  const n = typeof t?.name == "string" ? t.name : "", e = typeof t?.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t?.path == "string" ? t.path : "";
  return `path:${n}::${e}`;
}
function G(t) {
  const n = /* @__PURE__ */ new Map();
  for (const e of t) {
    const r = et(e);
    r && n.set(rt(e), r);
  }
  return [...n.values()];
}
function x(t) {
  return {
    id: g(t?.id),
    text: typeof t?.text == "string" ? t.text : "",
    export: nt(t?.export)
  };
}
function at(t) {
  return {
    id: g(t?.id),
    title: i(t?.title),
    text: i(t?.text)
  };
}
function it(t) {
  const n = [];
  for (const e of t) {
    const r = e && typeof e == "object" ? e.provider : void 0, a = e && typeof e == "object" ? e.externalId : void 0;
    (r === "zephyr" || r === "allure") && typeof a == "string" && a.trim() && n.push({ provider: r, externalId: a.trim() });
  }
  return n;
}
function st(t) {
  if (!t || typeof t != "object") return {};
  const n = {};
  for (const [e, r] of Object.entries(t))
    r != null && (n[e] = typeof r == "string" ? r : String(r));
  return n;
}
function ot(t) {
  return {
    tags: Array.isArray(t?.tags) ? t.tags.map((n) => String(n)) : [],
    params: st(t?.params),
    objective: i(t?.objective),
    preconditions: i(t?.preconditions),
    status: i(t?.status),
    priority: i(t?.priority),
    component: i(t?.component),
    owner: i(t?.owner),
    folder: i(t?.folder),
    estimated: i(t?.estimated),
    testType: i(t?.testType),
    automation: i(t?.automation),
    assignedTo: i(t?.assignedTo)
  };
}
function k(t) {
  const n = t ?? {}, e = Array.isArray(n?.internal?.meta?.attachments) ? n.internal.meta.attachments : [], r = i(
    n.raw?.providerStepId ?? n?.providerStepId ?? n?.internal?.meta?.providerStepId
  ), a = n.internal && typeof n.internal == "object" && n.internal.meta && typeof n.internal.meta == "object" ? { ...n.internal.meta } : void 0;
  return a && "attachments" in a && delete a.attachments, {
    id: g(n.id),
    action: i(n.action),
    data: i(n.data),
    expected: i(n.expected),
    text: i(n.text) ?? i(n.action) ?? "",
    raw: {
      action: i(n.raw?.action) ?? i(n.action),
      data: i(n.raw?.data) ?? i(n.data),
      expected: i(n.raw?.expected) ?? i(n.expected),
      ...r ? { providerStepId: r } : {}
    },
    subSteps: Array.isArray(n.subSteps) ? n.subSteps.map(at) : [],
    internal: {
      note: i(n.internal?.note),
      url: i(n.internal?.url),
      meta: a && Object.keys(a).length ? a : void 0,
      parts: {
        action: Array.isArray(n.internal?.parts?.action) ? n.internal.parts.action.map(x) : [],
        data: Array.isArray(n.internal?.parts?.data) ? n.internal.parts.data.map(x) : [],
        expected: Array.isArray(n.internal?.parts?.expected) ? n.internal.parts.expected.map(x) : []
      }
    },
    usesShared: i(n.usesShared),
    attachments: G([
      ...Array.isArray(n.attachments) ? n.attachments : [],
      ...e
    ])
  };
}
function D(t) {
  const n = t ?? {};
  return {
    id: g(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : "Untitled Test",
    description: i(n.description) ?? "",
    steps: Array.isArray(n.steps) ? n.steps.map(k) : [],
    attachments: G(Array.isArray(n.attachments) ? n.attachments : []),
    links: it(Array.isArray(n.links) ? n.links : []),
    updatedAt: z(n.updatedAt),
    meta: ot(n.meta),
    exportCfg: {
      enabled: typeof n.exportCfg?.enabled == "boolean" ? n.exportCfg.enabled : !0
    }
  };
}
function ct(t) {
  return Array.isArray(t?.children) ? B(t, i(t?.name) ?? "Folder") : D(t);
}
function B(t, n = "Folder") {
  const e = t ?? {};
  return {
    id: g(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : n,
    children: Array.isArray(e.children) ? e.children.map(ct) : []
  };
}
function Z(t) {
  const n = t ?? {};
  return {
    id: g(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : "Shared Step",
    steps: Array.isArray(n.steps) ? n.steps.map(k) : [],
    updatedAt: z(n.updatedAt)
  };
}
function N(t) {
  const n = t ?? {};
  return {
    root: B(n.root, "Root"),
    sharedSteps: Array.isArray(n.sharedSteps) ? n.sharedSteps.map(Z) : []
  };
}
const I = "tests_repo", J = "root", Y = "folder.json", W = "shared_steps.json", dt = ".snapshots", lt = ".publish-logs";
function R() {
  return w.isPackaged ? c.dirname(w.getPath("exe")) : process.cwd();
}
function pt(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function ut(t) {
  return t.includes("test.json");
}
async function y(t) {
  await m.mkdir(t, { recursive: !0 });
}
async function V(t) {
  try {
    const n = await m.readFile(t, "utf-8");
    return JSON.parse(n);
  } catch {
    return null;
  }
}
async function mt(t) {
  return V(c.join(t, Y));
}
async function St(t) {
  const n = await V(c.join(t, W));
  return Array.isArray(n) ? n.map(Z) : [];
}
async function ht() {
  const t = c.join(R(), I), n = c.join(t, J);
  await y(n);
  async function e(d, S) {
    const u = await m.readdir(d);
    if (ut(u)) {
      const s = await m.readFile(c.join(d, "test.json"), "utf-8");
      return D(JSON.parse(s));
    }
    const l = await mt(d), o = {
      id: typeof l?.id == "string" && l.id.trim() ? l.id : H(),
      name: typeof l?.name == "string" && l.name.trim() ? l.name : S,
      children: []
    };
    for (const s of u) {
      const h = c.join(d, s);
      (await m.lstat(h)).isDirectory() && o.children.push(await e(h, s));
    }
    return o;
  }
  const r = await e(n, "Root"), a = await St(t);
  return N({ root: r, sharedSteps: a });
}
async function ft(t) {
  const n = N(t), e = c.join(R(), I), r = c.join(e, J);
  await y(r);
  async function a(d, S) {
    await y(d), await m.writeFile(
      c.join(d, Y),
      JSON.stringify({ id: S.id, name: S.name }, null, 2),
      "utf-8"
    );
    const u = /* @__PURE__ */ new Map();
    for (const o of S.children) {
      if ("children" in o) {
        u.set(c.join(d, o.name), { node: o });
        continue;
      }
      const s = pt(o.name), h = o.id?.slice(0, 6) ?? H().slice(0, 6);
      u.set(c.join(d, `${s}__${h}`), { node: o });
    }
    for (const [o, s] of u.entries())
      "children" in s.node ? await a(o, s.node) : (await y(o), await y(c.join(o, "attachments")), await m.writeFile(
        c.join(o, "test.json"),
        JSON.stringify(D(s.node), null, 2),
        "utf-8"
      ));
    const l = await m.readdir(d);
    for (const o of l) {
      const s = c.join(d, o);
      (await m.lstat(s)).isDirectory() && (u.has(s) || await m.rm(s, { recursive: !0, force: !0 }));
    }
  }
  await a(r, n.root), await m.writeFile(
    c.join(e, W),
    JSON.stringify(n.sharedSteps, null, 2),
    "utf-8"
  );
}
async function wt(t, n = "snapshot", e) {
  const r = N(t), a = c.join(R(), I, dt);
  await y(a);
  const d = c.join(a, `${n}-${q()}.json`);
  return await m.writeFile(
    d,
    JSON.stringify({ createdAt: (/* @__PURE__ */ new Date()).toISOString(), kind: n, meta: e ?? {}, state: r }, null, 2),
    "utf-8"
  ), d;
}
async function yt(t) {
  const n = c.join(R(), I, lt);
  await y(n);
  const e = c.join(n, `publish-${q()}.json`);
  return await m.writeFile(e, JSON.stringify(t, null, 2), "utf-8"), e;
}
function q() {
  const t = /* @__PURE__ */ new Date(), n = [
    t.getFullYear(),
    String(t.getMonth() + 1).padStart(2, "0"),
    String(t.getDate()).padStart(2, "0")
  ].join(""), e = [
    String(t.getHours()).padStart(2, "0"),
    String(t.getMinutes()).padStart(2, "0"),
    String(t.getSeconds()).padStart(2, "0")
  ].join("-");
  return `${n}-${e}`;
}
const P = "testshub-atlassian";
function gt() {
  return w.isPackaged ? c.dirname(w.getPath("exe")) : process.cwd();
}
const $ = c.join(gt(), "tests_repo", ".settings.json");
async function At(t) {
  await m.mkdir(c.dirname(t), { recursive: !0 });
}
async function E() {
  try {
    const t = await m.readFile($, "utf-8"), n = JSON.parse(t), e = n.login ?? "", r = n.baseUrl ?? "", a = e ? !!await j.getPassword(P, e) : !1;
    return { login: e, baseUrl: r, hasSecret: a };
  } catch {
    return { login: "", baseUrl: "", hasSecret: !1 };
  }
}
async function Et(t, n, e) {
  await At($);
  const r = { login: t, baseUrl: e };
  await m.writeFile($, JSON.stringify(r, null, 2), "utf-8"), t && typeof n == "string" && n.length > 0 && await j.setPassword(P, t, n);
  const a = t ? !!await j.getPassword(P, t) : !1;
  return { login: t, baseUrl: e ?? "", hasSecret: a };
}
async function T(t) {
  return t ? await j.getPassword(P, t) : null;
}
function U(t) {
  return (t || "").replace(/\/+$/, "");
}
function O(t) {
  return Buffer.from(t, "utf8").toString("base64");
}
function Tt(t) {
  t.handle(f.LOAD_STATE, async (n, e) => {
    try {
      return await ht();
    } catch {
      return e;
    }
  }), t.handle(f.SAVE_STATE, async (n, e) => (await ft(e), !0)), t.handle(f.WRITE_STATE_SNAPSHOT, async (n, e) => await wt(e.state, e.kind, e.meta)), t.handle(f.WRITE_PUBLISH_LOG, async (n, e) => await yt(e)), t.handle(f.LOAD_SETTINGS, async () => await E()), t.handle(
    f.SAVE_SETTINGS,
    async (n, e) => await Et(e.login, e.passwordOrToken, e.baseUrl)
  ), t.handle(
    f.GET_ATLASSIAN_SECRET,
    async (n, e) => await T(e.login) ?? ""
  ), t.handle(
    f.ZEPHYR_GET_TESTCASE,
    async (n, e) => {
      const r = await E(), a = r.login || "", d = U(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const S = await T(a) || "";
      if (!S) throw new Error("Atlassian password is not stored in keychain");
      const u = `${d}/rest/atm/1.0/testcase/${encodeURIComponent(e.ref)}`, l = `Basic ${O(`${a}:${S}`)}`, o = await fetch(u, {
        method: "GET",
        headers: { Authorization: l, Accept: "application/json" }
      });
      if (!o.ok) {
        const s = await o.text().catch(() => "");
        throw new Error(
          `Zephyr(${e.by}) ${o.status} ${o.statusText}` + (s ? ` – ${s.slice(0, 300)}` : "")
        );
      }
      return await o.json();
    }
  ), t.handle(
    f.ZEPHYR_SEARCH_TESTCASES,
    async (n, e) => {
      const r = await E(), a = r.login || "", d = U(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const S = await T(a) || "";
      if (!S) throw new Error("Atlassian password is not stored in keychain");
      const u = String(e.query ?? "").trim();
      if (!u) throw new Error("Zephyr search query is empty");
      const l = new URL(`${d}/rest/atm/1.0/testcase/search`);
      l.searchParams.set("query", u), l.searchParams.set("startAt", String(Math.max(0, Number(e.startAt ?? 0) || 0))), l.searchParams.set("maxResults", String(Math.max(1, Number(e.maxResults ?? 100) || 100)));
      const o = `Basic ${O(`${a}:${S}`)}`, s = await fetch(l, {
        method: "GET",
        headers: { Authorization: o, Accept: "application/json" }
      });
      if (!s.ok) {
        const h = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(search) ${s.status} ${s.statusText}` + (h ? ` – ${h.slice(0, 300)}` : "")
        );
      }
      return await s.json();
    }
  ), t.handle(
    f.ZEPHYR_UPSERT_TESTCASE,
    async (n, e) => {
      const r = await E(), a = r.login || "", d = U(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const S = await T(a) || "";
      if (!S) throw new Error("Atlassian password is not stored in keychain");
      const u = typeof e.ref == "string" && e.ref.trim() ? e.ref.trim() : "", l = u ? `${d}/rest/atm/1.0/testcase/${encodeURIComponent(u)}` : `${d}/rest/atm/1.0/testcase`, o = `Basic ${O(`${a}:${S}`)}`, s = await fetch(l, {
        method: u ? "PUT" : "POST",
        headers: {
          Authorization: o,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(e.body ?? {})
      });
      if (!s.ok) {
        const h = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(upsert) ${s.status} ${s.statusText}` + (h ? ` – ${h.slice(0, 400)}` : "")
        );
      }
      return await s.json().catch(() => ({}));
    }
  );
}
let _ = null;
async function M() {
  _ = new F({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: c.join(w.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const t = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  try {
    await _.loadURL(t), _.webContents.openDevTools({ mode: "detach" });
  } catch (n) {
    console.error("Failed to load renderer dev URL:", t, n), await _.loadFile(c.join(w.getAppPath(), "dist", "index.html"));
  }
}
w.whenReady().then(() => {
  Tt(K), M();
});
w.on("window-all-closed", () => {
  process.platform !== "darwin" && w.quit();
});
w.on("activate", () => {
  F.getAllWindows().length === 0 && M();
});
//# sourceMappingURL=main.mjs.map
