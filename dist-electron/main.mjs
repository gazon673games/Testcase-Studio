import { app as u, BrowserWindow as y, ipcMain as b } from "electron";
import s from "node:path";
import { promises as c } from "fs";
import { randomUUID as P } from "crypto";
import T from "keytar";
const h = {
  LOAD_STATE: "LOAD_STATE",
  SAVE_STATE: "SAVE_STATE",
  LOAD_SETTINGS: "LOAD_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_ATLASSIAN_SECRET: "GET_ATLASSIAN_SECRET",
  ZEPHYR_GET_TESTCASE: "ZEPHYR_GET_TESTCASE"
};
function j() {
  return u.isPackaged ? s.dirname(u.getPath("exe")) : process.cwd();
}
const N = "tests_repo";
function I(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "node";
}
function L(t, n) {
  return n.includes("test.json");
}
async function f(t) {
  await c.mkdir(t, { recursive: !0 });
}
async function U() {
  const t = s.join(j(), N);
  await f(t);
  const n = s.join(t, "root");
  await f(n);
  async function e(r) {
    const d = await c.readdir(r);
    if (L(r, d)) {
      const w = await c.readFile(s.join(r, "test.json"), "utf-8");
      return JSON.parse(w);
    }
    const l = { id: P(), name: s.basename(r), children: [] };
    for (const w of d) {
      const o = s.join(r, w);
      (await c.lstat(o)).isDirectory() && l.children.push(await e(o));
    }
    return l;
  }
  return { root: await e(n), sharedSteps: [] };
}
async function $(t) {
  const n = s.join(j(), N);
  await f(n);
  const e = s.join(n, "root");
  await f(e);
  async function i(r, d) {
    await f(r);
    const l = /* @__PURE__ */ new Map();
    for (const o of d.children)
      if ("children" in o) {
        const a = s.join(r, o.name);
        l.set(a, { node: o, targetPath: a });
      } else {
        const a = I(o.name), S = o.id?.slice(0, 6) ?? P().slice(0, 6), _ = s.join(r, `${a}__${S}`);
        l.set(_, { node: o, targetPath: _ });
      }
    for (const { node: o, targetPath: a } of l.values())
      "children" in o ? await i(a, o) : (await f(a), await f(s.join(a, "attachments")), await c.writeFile(s.join(a, "test.json"), JSON.stringify(o, null, 2), "utf-8"));
    const w = await c.readdir(r);
    for (const o of w) {
      const a = s.join(r, o);
      (await c.lstat(a)).isDirectory() && (l.has(a) || await c.rm(a, { recursive: !0, force: !0 }));
    }
  }
  await i(e, t.root);
}
const A = "testshub-atlassian";
function D() {
  return u.isPackaged ? s.dirname(u.getPath("exe")) : process.cwd();
}
const g = s.join(D(), "tests_repo", ".settings.json");
async function G(t) {
  await c.mkdir(s.dirname(t), { recursive: !0 });
}
async function p() {
  try {
    const t = await c.readFile(g, "utf-8"), n = JSON.parse(t), e = n.login ?? "", i = n.baseUrl ?? "", r = e ? !!await T.getPassword(A, e) : !1;
    return { login: e, baseUrl: i, hasSecret: r };
  } catch {
    return { login: "", baseUrl: "", hasSecret: !1 };
  }
}
async function F(t, n, e) {
  await G(g);
  const i = { login: t, baseUrl: e };
  await c.writeFile(g, JSON.stringify(i, null, 2), "utf-8"), t && typeof n == "string" && n.length > 0 && await T.setPassword(A, t, n);
  const r = t ? !!await T.getPassword(A, t) : !1;
  return { login: t, baseUrl: e ?? "", hasSecret: r };
}
async function m(t) {
  return t ? await T.getPassword(A, t) : null;
}
function C(t) {
  return (t || "").replace(/\/+$/, "");
}
function v(t) {
  return Buffer.from(t, "utf8").toString("base64");
}
function O(t) {
  t.handle(h.LOAD_STATE, async (n, e) => {
    try {
      return await U();
    } catch {
      return e;
    }
  }), t.handle(h.SAVE_STATE, async (n, e) => (await $(e), !0)), t.handle(h.LOAD_SETTINGS, async () => await p()), t.handle(
    h.SAVE_SETTINGS,
    async (n, e) => await F(e.login, e.passwordOrToken, e.baseUrl)
  ), t.handle(
    h.GET_ATLASSIAN_SECRET,
    async (n, e) => await m(e.login) ?? ""
  ), t.handle(
    h.ZEPHYR_GET_TESTCASE,
    async (n, e) => {
      const i = await p(), r = i.login || "", d = C(i.baseUrl || "");
      if (!r) throw new Error("Atlassian login is empty in settings");
      if (!d) throw new Error("Atlassian baseUrl is empty in settings");
      const l = await m(r) || "";
      if (!l) throw new Error("Atlassian password is not stored in keychain");
      const w = `${d}/rest/atm/1.0/testcase/${encodeURIComponent(e.ref)}`, o = `Basic ${v(`${r}:${l}`)}`, a = await fetch(w, {
        method: "GET",
        headers: { Authorization: o, Accept: "application/json" }
      });
      if (!a.ok) {
        const S = await a.text().catch(() => "");
        throw new Error(
          `Zephyr(${e.by}) ${a.status} ${a.statusText}` + (S ? ` – ${S.slice(0, 300)}` : "")
        );
      }
      return await a.json();
    }
  );
}
let E = null;
async function R() {
  E = new y({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: s.join(u.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    }
  });
  const t = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";
  try {
    await E.loadURL(t), E.webContents.openDevTools({ mode: "detach" });
  } catch (n) {
    console.error("Failed to load renderer dev URL:", t, n), await E.loadFile(s.join(u.getAppPath(), "dist", "index.html"));
  }
}
u.whenReady().then(() => {
  O(b), R();
});
u.on("window-all-closed", () => {
  process.platform !== "darwin" && u.quit();
});
u.on("activate", () => {
  y.getAllWindows().length === 0 && R();
});
//# sourceMappingURL=main.mjs.map
