/* Backend tests: npm test. Starts the server on a temporary database and checks the API end to end. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = 4100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fw-test-"));
let server;

async function req(method, url, { body, cookie, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (cookie) init.headers.cookie = cookie;
  if (body !== undefined) {
    init.headers["content-type"] = init.headers["content-type"] || "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(BASE + url, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, json, text, cookie: setCookie ? setCookie.split(";")[0] : null };
}
async function account(email) {
  const r = await req("POST", "/api/auth/register", { body: { name: "Test " + email, email, goal: "build", password: "StrongPass123", confirmPassword: "StrongPass123" } });
  assert.equal(r.status, 201, "register " + email);
  return r.cookie;
}

before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "development", DATABASE_FILE: path.join(tmp, "test.sqlite"), SESSION_SECRET: "test-secret-that-is-at-least-32-characters-long" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let err = "";
  server.stderr.on("data", d => (err += d));
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("server did not start: " + err);
});
after(() => { if (server) server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("account data needs a login", async () => {
  const r = await req("GET", "/api/me/data");
  assert.equal(r.status, 401);
  const w = await req("PUT", "/api/me/data", { body: { baseVersion: 0, data: {} } });
  assert.equal(w.status, 401);
});

test("a new account starts with no saved data (version 0)", async () => {
  const cookie = await account("fresh@example.com");
  const r = await req("GET", "/api/me/data", { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { version: 0, updatedAt: null, data: null });
});

test("saving data bumps the version and reads back exactly", async () => {
  const cookie = await account("saver@example.com");
  const data = { workouts: [{ name: "Back + Biceps", duration: 40 }], recovery: [{ feeling: "Fatigued", severity: "Mild", notes: "" }], extra: { goal: "build" } };
  const put = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data } });
  assert.equal(put.status, 200);
  assert.equal(put.json.version, 1);
  const get = await req("GET", "/api/me/data", { cookie });
  assert.equal(get.json.version, 1);
  assert.deepEqual(get.json.data, data);
  assert.ok(get.json.updatedAt);
});

test("a save based on an old version is refused with 409 and the current version", async () => {
  const cookie = await account("conflict@example.com");
  await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: { workouts: [1] } } });
  const stale = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: { workouts: [2] } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.version, 1);
  const get = await req("GET", "/api/me/data", { cookie });
  assert.deepEqual(get.json.data, { workouts: [1] }, "the stale save must not overwrite");
  const fresh = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 1, data: { workouts: [2] } } });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.json.version, 2);
});

test("only the app's own keys are stored", async () => {
  const cookie = await account("keys@example.com");
  await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: { workouts: [], secretThing: { x: 1 }, __proto__hack: 1 } } });
  const get = await req("GET", "/api/me/data", { cookie });
  assert.equal("secretThing" in get.json.data, false);
  assert.equal("workouts" in get.json.data, true);
});

test("accounts cannot see each other's data", async () => {
  const a = await account("alice@example.com");
  const b = await account("bob@example.com");
  await req("PUT", "/api/me/data", { cookie: a, body: { baseVersion: 0, data: { recovery: [{ feeling: "Alice only" }] } } });
  const bob = await req("GET", "/api/me/data", { cookie: b });
  assert.equal(bob.json.version, 0);
  assert.equal(bob.json.data, null);
});

test("bad input gets a clear 4xx, not a 500", async () => {
  const cookie = await account("badinput@example.com");
  const arr = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: [1, 2] } });
  assert.equal(arr.status, 400);
  const noVersion = await req("PUT", "/api/me/data", { cookie, body: { data: {} } });
  assert.equal(noVersion.status, 400);
  const broken = await req("PUT", "/api/me/data", { cookie, body: '{"baseVersion":0,' });
  assert.equal(broken.status, 400);
  assert.equal(broken.json.error !== undefined, true);
});

test("data that is too large is refused", async () => {
  const cookie = await account("big@example.com");
  const huge = { posts: ["x".repeat(950 * 1024)] };
  const r = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: huge } });
  assert.equal(r.status, 413);
  const way = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: { posts: ["x".repeat(2 * 1024 * 1024)] } } });
  assert.equal(way.status, 413);
});

test("cross-site saves are blocked", async () => {
  const cookie = await account("origin@example.com");
  const r = await req("PUT", "/api/me/data", { cookie, body: { baseVersion: 0, data: {} }, headers: { origin: "https://evil.example" } });
  assert.equal(r.status, 403);
});

test("logging out ends access to the data", async () => {
  const cookie = await account("logout@example.com");
  assert.equal((await req("GET", "/api/me/data", { cookie })).status, 200);
  await req("POST", "/api/auth/logout", { cookie, body: {} });
  assert.equal((await req("GET", "/api/me/data", { cookie })).status, 401);
});
