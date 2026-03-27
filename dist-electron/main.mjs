import { app as S, BrowserWindow as z, ipcMain as tt } from "electron";
import d from "node:path";
import { readFile as et } from "node:fs/promises";
import { promises as w } from "fs";
import Z, { randomUUID as k } from "crypto";
import $ from "keytar";
const f = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET",
  ZEPHYR_GET_TESTCASE: "ZEPHYR_GET_TESTCASE",
  ZEPHYR_SEARCH_TESTCASES: "ZEPHYR_SEARCH_TESTCASES",
  ZEPHYR_UPSERT_TESTCASE: "ZEPHYR_UPSERT_TESTCASE",
  ZEPHYR_UPLOAD_ATTACHMENT: "ZEPHYR_UPLOAD_ATTACHMENT",
  ZEPHYR_DELETE_ATTACHMENT: "ZEPHYR_DELETE_ATTACHMENT",
  WRITE_STATE_SNAPSHOT: "WRITE_STATE_SNAPSHOT",
  WRITE_PUBLISH_LOG: "WRITE_PUBLISH_LOG"
}, R = new Uint8Array(256);
let U = R.length;
function nt() {
  return U > R.length - 16 && (Z.randomFillSync(R), U = 0), R.slice(U, U += 16);
}
const u = [];
for (let t = 0; t < 256; ++t)
  u.push((t + 256).toString(16).slice(1));
function rt(t, e = 0) {
  return u[t[e + 0]] + u[t[e + 1]] + u[t[e + 2]] + u[t[e + 3]] + "-" + u[t[e + 4]] + u[t[e + 5]] + "-" + u[t[e + 6]] + u[t[e + 7]] + "-" + u[t[e + 8]] + u[t[e + 9]] + "-" + u[t[e + 10]] + u[t[e + 11]] + u[t[e + 12]] + u[t[e + 13]] + u[t[e + 14]] + u[t[e + 15]];
}
const F = {
  randomUUID: Z.randomUUID
};
function at(t, e, n) {
  if (F.randomUUID && !t)
    return F.randomUUID();
  t = t || {};
  const r = t.random || (t.rng || nt)();
  return r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, rt(r);
}
function st() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function c(t) {
  if (typeof t != "string") return t == null ? void 0 : String(t);
  const e = t.trim();
  return e.length ? e : void 0;
}
function it(t) {
  return typeof t == "boolean" ? t : void 0;
}
function E(t) {
  return typeof t == "string" && t.trim() ? t.trim() : at();
}
function B(t) {
  return typeof t == "string" && t.trim() ? t : st();
}
function ot(t) {
  if (!t || typeof t != "object") return null;
  const e = typeof t.name == "string" ? t.name : "attachment", n = typeof t.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t.path == "string" ? t.path : "";
  return !e && !n ? null : {
    id: E(t.id),
    name: e,
    pathOrDataUrl: n
  };
}
function ct(t) {
  if (t && typeof t.id == "string" && t.id.trim()) return `id:${t.id.trim()}`;
  const e = typeof t?.name == "string" ? t.name : "", n = typeof t?.pathOrDataUrl == "string" ? t.pathOrDataUrl : typeof t?.path == "string" ? t.path : "";
  return `path:${e}::${n}`;
}
function G(t) {
  const e = /* @__PURE__ */ new Map();
  for (const n of t) {
    const r = ot(n);
    r && e.set(ct(n), r);
  }
  return [...e.values()];
}
function D(t) {
  return {
    id: E(t?.id),
    text: typeof t?.text == "string" ? t.text : "",
    export: it(t?.export)
  };
}
function dt(t) {
  return {
    id: E(t?.id),
    title: c(t?.title),
    text: c(t?.text)
  };
}
function lt(t) {
  const e = [];
  for (const n of t) {
    const r = n && typeof n == "object" ? n.provider : void 0, a = n && typeof n == "object" ? n.externalId : void 0;
    (r === "zephyr" || r === "allure") && typeof a == "string" && a.trim() && e.push({ provider: r, externalId: a.trim() });
  }
  return e;
}
function ht(t) {
  if (!t || typeof t != "object") return {};
  const e = {};
  for (const [n, r] of Object.entries(t))
    r != null && (e[n] = typeof r == "string" ? r : String(r));
  return e;
}
function mt(t) {
  return {
    tags: Array.isArray(t?.tags) ? t.tags.map((e) => String(e)) : [],
    params: ht(t?.params),
    objective: c(t?.objective),
    preconditions: c(t?.preconditions),
    status: c(t?.status),
    priority: c(t?.priority),
    component: c(t?.component),
    owner: c(t?.owner),
    folder: c(t?.folder),
    estimated: c(t?.estimated),
    testType: c(t?.testType),
    automation: c(t?.automation),
    assignedTo: c(t?.assignedTo)
  };
}
function Y(t) {
  const e = t ?? {}, n = Array.isArray(e?.internal?.meta?.attachments) ? e.internal.meta.attachments : [], r = c(
    e.raw?.providerStepId ?? e?.providerStepId ?? e?.internal?.meta?.providerStepId
  ), a = e.internal && typeof e.internal == "object" && e.internal.meta && typeof e.internal.meta == "object" ? { ...e.internal.meta } : void 0;
  return a && "attachments" in a && delete a.attachments, {
    id: E(e.id),
    action: c(e.action),
    data: c(e.data),
    expected: c(e.expected),
    text: c(e.text) ?? c(e.action) ?? "",
    raw: {
      action: c(e.raw?.action) ?? c(e.action),
      data: c(e.raw?.data) ?? c(e.data),
      expected: c(e.raw?.expected) ?? c(e.expected),
      ...r ? { providerStepId: r } : {}
    },
    subSteps: Array.isArray(e.subSteps) ? e.subSteps.map(dt) : [],
    internal: {
      note: c(e.internal?.note),
      url: c(e.internal?.url),
      meta: a && Object.keys(a).length ? a : void 0,
      parts: {
        action: Array.isArray(e.internal?.parts?.action) ? e.internal.parts.action.map(D) : [],
        data: Array.isArray(e.internal?.parts?.data) ? e.internal.parts.data.map(D) : [],
        expected: Array.isArray(e.internal?.parts?.expected) ? e.internal.parts.expected.map(D) : []
      }
    },
    usesShared: c(e.usesShared),
    attachments: G([
      ...Array.isArray(e.attachments) ? e.attachments : [],
      ...n
    ])
  };
}
function C(t) {
  const e = t ?? {};
  return {
    id: E(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : "Untitled Test",
    description: c(e.description) ?? "",
    steps: Array.isArray(e.steps) ? e.steps.map(Y) : [],
    attachments: G(Array.isArray(e.attachments) ? e.attachments : []),
    links: lt(Array.isArray(e.links) ? e.links : []),
    updatedAt: B(e.updatedAt),
    meta: mt(e.meta),
    exportCfg: {
      enabled: typeof e.exportCfg?.enabled == "boolean" ? e.exportCfg.enabled : !0
    }
  };
}
function ut(t) {
  return Array.isArray(t?.children) ? J(t, c(t?.name) ?? "Folder") : C(t);
}
function J(t, e = "Folder") {
  const n = t ?? {};
  return {
    id: E(n.id),
    name: typeof n.name == "string" && n.name.trim() ? n.name : e,
    children: Array.isArray(n.children) ? n.children.map(ut) : []
  };
}
function W(t) {
  const e = t ?? {};
  return {
    id: E(e.id),
    name: typeof e.name == "string" && e.name.trim() ? e.name : "Shared Step",
    steps: Array.isArray(e.steps) ? e.steps.map(Y) : [],
    updatedAt: B(e.updatedAt)
  };
}
function H(t) {
  const e = t ?? {};
  return {
    root: J(e.root, "Root"),
    sharedSteps: Array.isArray(e.sharedSteps) ? e.sharedSteps.map(W) : []
  };
}
const I = "tests_repo", q = "root", M = "folder.json", V = "shared_steps.json", pt = ".snapshots", wt = ".publish-logs";
function j() {
  return S.isPackaged ? d.dirname(S.getPath("exe")) : process.cwd();
}
function ft(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function St(t) {
  return t.includes("test.json");
}
async function y(t) {
  await w.mkdir(t, { recursive: !0 });
}
async function K(t) {
  try {
    const e = await w.readFile(t, "utf-8");
    return JSON.parse(e);
  } catch {
    return null;
  }
}
async function yt(t) {
  return K(d.join(t, M));
}
async function Et(t) {
  const e = await K(d.join(t, V));
  return Array.isArray(e) ? e.map(W) : [];
}
async function At() {
  const t = d.join(j(), I), e = d.join(t, q);
  await y(e);
  async function n(o, m) {
    const l = await w.readdir(o);
    if (St(l)) {
      const s = await w.readFile(d.join(o, "test.json"), "utf-8");
      return C(JSON.parse(s));
    }
    const h = await yt(o), i = {
      id: typeof h?.id == "string" && h.id.trim() ? h.id : k(),
      name: typeof h?.name == "string" && h.name.trim() ? h.name : m,
      children: []
    };
    for (const s of l) {
      const p = d.join(o, s);
      (await w.lstat(p)).isDirectory() && i.children.push(await n(p, s));
    }
    return i;
  }
  const r = await n(e, "Root"), a = await Et(t);
  return H({ root: r, sharedSteps: a });
}
async function gt(t) {
  const e = H(t), n = d.join(j(), I), r = d.join(n, q);
  await y(r);
  async function a(o, m) {
    await y(o), await w.writeFile(
      d.join(o, M),
      JSON.stringify({ id: m.id, name: m.name }, null, 2),
      "utf-8"
    );
    const l = /* @__PURE__ */ new Map();
    for (const i of m.children) {
      if ("children" in i) {
        l.set(d.join(o, i.name), { node: i });
        continue;
      }
      const s = ft(i.name), p = i.id?.slice(0, 6) ?? k().slice(0, 6);
      l.set(d.join(o, `${s}__${p}`), { node: i });
    }
    for (const [i, s] of l.entries())
      "children" in s.node ? await a(i, s.node) : (await y(i), await y(d.join(i, "attachments")), await w.writeFile(
        d.join(i, "test.json"),
        JSON.stringify(C(s.node), null, 2),
        "utf-8"
      ));
    const h = await w.readdir(o);
    for (const i of h) {
      const s = d.join(o, i);
      (await w.lstat(s)).isDirectory() && (l.has(s) || await w.rm(s, { recursive: !0, force: !0 }));
    }
  }
  await a(r, e.root), await w.writeFile(
    d.join(n, V),
    JSON.stringify(e.sharedSteps, null, 2),
    "utf-8"
  );
}
async function Tt(t, e = "snapshot", n) {
  const r = H(t), a = d.join(j(), I, pt);
  await y(a);
  const o = d.join(a, `${e}-${Q()}.json`);
  return await w.writeFile(
    o,
    JSON.stringify({ createdAt: (/* @__PURE__ */ new Date()).toISOString(), kind: e, meta: n ?? {}, state: r }, null, 2),
    "utf-8"
  ), o;
}
async function _t(t) {
  const e = d.join(j(), I, wt);
  await y(e);
  const n = d.join(e, `publish-${Q()}.json`);
  return await w.writeFile(n, JSON.stringify(t, null, 2), "utf-8"), n;
}
function Q() {
  const t = /* @__PURE__ */ new Date(), e = [
    t.getFullYear(),
    String(t.getMonth() + 1).padStart(2, "0"),
    String(t.getDate()).padStart(2, "0")
  ].join(""), n = [
    String(t.getHours()).padStart(2, "0"),
    String(t.getMinutes()).padStart(2, "0"),
    String(t.getSeconds()).padStart(2, "0")
  ].join("-");
  return `${e}-${n}`;
}
const x = "testshub-atlassian";
function bt() {
  return S.isPackaged ? d.dirname(S.getPath("exe")) : process.cwd();
}
const N = d.join(bt(), "tests_repo", ".settings.json");
async function Ut(t) {
  await w.mkdir(d.dirname(t), { recursive: !0 });
}
async function A() {
  try {
    const t = await w.readFile(N, "utf-8"), e = JSON.parse(t), n = e.login ?? "", r = e.baseUrl ?? "", a = n ? !!await $.getPassword(x, n) : !1;
    return { login: n, baseUrl: r, hasSecret: a };
  } catch {
    return { login: "", baseUrl: "", hasSecret: !1 };
  }
}
async function Pt(t, e, n) {
  await Ut(N);
  const r = { login: t, baseUrl: n };
  await w.writeFile(N, JSON.stringify(r, null, 2), "utf-8"), t && typeof e == "string" && e.length > 0 && await $.setPassword(x, t, e);
  const a = t ? !!await $.getPassword(x, t) : !1;
  return { login: t, baseUrl: n ?? "", hasSecret: a };
}
async function g(t) {
  return t ? await $.getPassword(x, t) : null;
}
function _(t) {
  return (t || "").replace(/\/+$/, "");
}
function b(t) {
  return Buffer.from(t, "utf8").toString("base64");
}
function Rt(t) {
  const n = String(t ?? "").match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!n)
    throw new Error("NOT_A_DATA_URL");
  const r = n[3] ?? "";
  return n[2] ? Buffer.from(r, "base64") : Buffer.from(decodeURIComponent(r), "utf8");
}
function $t(t) {
  t.handle(f.LOAD_STATE, async (e, n) => {
    try {
      return await At();
    } catch {
      return n;
    }
  }), t.handle(f.SAVE_STATE, async (e, n) => (await gt(n), !0)), t.handle(f.WRITE_STATE_SNAPSHOT, async (e, n) => await Tt(n.state, n.kind, n.meta)), t.handle(f.WRITE_PUBLISH_LOG, async (e, n) => await _t(n)), t.handle(f.LOAD_SETTINGS, async () => await A()), t.handle(
    f.SAVE_SETTINGS,
    async (e, n) => await Pt(n.login, n.passwordOrToken, n.baseUrl)
  ), t.handle(
    f.GET_ATLASSIAN_SECRET,
    async (e, n) => await g(n.login) ?? ""
  ), t.handle(
    f.ZEPHYR_GET_TESTCASE,
    async (e, n) => {
      const r = await A(), a = r.login || "", o = _(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!o) throw new Error("Atlassian baseUrl is empty in settings");
      const m = await g(a) || "";
      if (!m) throw new Error("Atlassian password is not stored in keychain");
      const l = `${o}/rest/atm/1.0/testcase/${encodeURIComponent(n.ref)}`, h = `Basic ${b(`${a}:${m}`)}`, i = await fetch(l, {
        method: "GET",
        headers: { Authorization: h, Accept: "application/json" }
      });
      if (!i.ok) {
        const s = await i.text().catch(() => "");
        throw new Error(
          `Zephyr(${n.by}) ${i.status} ${i.statusText}` + (s ? ` – ${s.slice(0, 300)}` : "")
        );
      }
      return await i.json();
    }
  ), t.handle(
    f.ZEPHYR_SEARCH_TESTCASES,
    async (e, n) => {
      const r = await A(), a = r.login || "", o = _(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!o) throw new Error("Atlassian baseUrl is empty in settings");
      const m = await g(a) || "";
      if (!m) throw new Error("Atlassian password is not stored in keychain");
      const l = String(n.query ?? "").trim();
      if (!l) throw new Error("Zephyr search query is empty");
      const h = new URL(`${o}/rest/atm/1.0/testcase/search`);
      h.searchParams.set("query", l), h.searchParams.set("startAt", String(Math.max(0, Number(n.startAt ?? 0) || 0))), h.searchParams.set("maxResults", String(Math.max(1, Number(n.maxResults ?? 100) || 100)));
      const i = `Basic ${b(`${a}:${m}`)}`, s = await fetch(h, {
        method: "GET",
        headers: { Authorization: i, Accept: "application/json" }
      });
      if (!s.ok) {
        const p = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(search) ${s.status} ${s.statusText}` + (p ? ` – ${p.slice(0, 300)}` : "")
        );
      }
      return await s.json();
    }
  ), t.handle(
    f.ZEPHYR_UPSERT_TESTCASE,
    async (e, n) => {
      const r = await A(), a = r.login || "", o = _(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!o) throw new Error("Atlassian baseUrl is empty in settings");
      const m = await g(a) || "";
      if (!m) throw new Error("Atlassian password is not stored in keychain");
      const l = typeof n.ref == "string" && n.ref.trim() ? n.ref.trim() : "", h = l ? `${o}/rest/atm/1.0/testcase/${encodeURIComponent(l)}` : `${o}/rest/atm/1.0/testcase`, i = `Basic ${b(`${a}:${m}`)}`, s = await fetch(h, {
        method: l ? "PUT" : "POST",
        headers: {
          Authorization: i,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(n.body ?? {})
      });
      if (!s.ok) {
        const p = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(upsert) ${s.status} ${s.statusText}` + (p ? ` – ${p.slice(0, 400)}` : "")
        );
      }
      return await s.json().catch(() => ({}));
    }
  ), t.handle(
    f.ZEPHYR_UPLOAD_ATTACHMENT,
    async (e, n) => {
      const r = await A(), a = r.login || "", o = _(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!o) throw new Error("Atlassian baseUrl is empty in settings");
      const m = await g(a) || "";
      if (!m) throw new Error("Atlassian password is not stored in keychain");
      const l = String(n.testCaseKey ?? "").trim();
      if (!l) throw new Error("Zephyr attachment upload requires a test case key");
      const h = String(n.attachment?.name ?? "").trim() || "attachment", i = String(n.attachment?.pathOrDataUrl ?? "");
      if (!i) throw new Error(`Attachment "${h}" has no file content`);
      let s;
      try {
        s = Rt(i);
      } catch {
        s = await et(i);
      }
      const p = `Basic ${b(`${a}:${m}`)}`, O = new FormData();
      O.append("file", new Blob([s]), h);
      const v = `${o}/rest/atm/1.0/testcase/${encodeURIComponent(l)}/attachments`, T = await fetch(v, {
        method: "POST",
        body: O,
        headers: { Authorization: p }
      });
      if (!T.ok) {
        const L = await T.text().catch(() => "");
        throw new Error(
          `Zephyr(upload attachment) ${T.status} ${T.statusText}` + (L ? ` – ${L.slice(0, 400)}` : "")
        );
      }
      return await T.json().catch(() => ({}));
    }
  ), t.handle(
    f.ZEPHYR_DELETE_ATTACHMENT,
    async (e, n) => {
      const r = await A(), a = r.login || "", o = _(r.baseUrl || "");
      if (!a) throw new Error("Atlassian login is empty in settings");
      if (!o) throw new Error("Atlassian baseUrl is empty in settings");
      const m = await g(a) || "";
      if (!m) throw new Error("Atlassian password is not stored in keychain");
      const l = String(n.attachmentId ?? "").trim();
      if (!l) throw new Error("Zephyr attachment delete requires an attachment id");
      const h = `Basic ${b(`${a}:${m}`)}`, i = `${o}/rest/atm/1.0/attachment/${encodeURIComponent(l)}`, s = await fetch(i, {
        method: "DELETE",
        headers: { Authorization: h, Accept: "application/json" }
      });
      if (!s.ok) {
        const p = await s.text().catch(() => "");
        throw new Error(
          `Zephyr(delete attachment) ${s.status} ${s.statusText}` + (p ? ` – ${p.slice(0, 300)}` : "")
        );
      }
      return !0;
    }
  );
}
let P = null;
async function X() {
  P = new z({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: d.join(S.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const t = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  try {
    await P.loadURL(t), P.webContents.openDevTools({ mode: "detach" });
  } catch (e) {
    console.error("Failed to load renderer dev URL:", t, e), await P.loadFile(d.join(S.getAppPath(), "dist", "index.html"));
  }
}
S.whenReady().then(() => {
  $t(tt), X();
});
S.on("window-all-closed", () => {
  process.platform !== "darwin" && S.quit();
});
S.on("activate", () => {
  z.getAllWindows().length === 0 && X();
});
//# sourceMappingURL=main.mjs.map
