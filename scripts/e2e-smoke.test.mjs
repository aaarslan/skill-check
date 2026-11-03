import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const PORT = 41739;
const BASE = `http://127.0.0.1:${PORT}`;
let server;

async function waitForServer(deadlineMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const response = await fetch(BASE, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("preview server did not become ready");
}

before(async () => {
  const build = spawnSync("pnpm", ["build"], { encoding: "utf8", timeout: 120000 });
  assert.equal(build.status, 0, build.stderr);
  server = spawn(
    "pnpm",
    ["exec", "vp", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    {
      stdio: "ignore",
      detached: true,
    },
  );
  await waitForServer();
});

after(() => {
  if (server?.pid)
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
});

test("production build serves the app shell, CSP, and manifest", async () => {
  const response = await fetch(BASE);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Skillcheck<\/title>/u);
  assert.match(html, /Content-Security-Policy/u);
  assert.match(html, /manifest\.webmanifest/u);
  assert.match(html, /\/assets\/index-[^"]+\.js/u);
  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  assert.equal(manifest.name, "Skillcheck");
  const assetPath = /\/assets\/index-[^"]+\.js/u.exec(html)?.[0];
  assert.ok(assetPath);
  const asset = await fetch(`${BASE}${assetPath}`);
  assert.equal(asset.status, 200);
  assert.match(await asset.text(), /Skillcheck/u);
});
