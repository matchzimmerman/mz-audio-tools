import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Serial effects lab", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Serial — Sequential Effects Lab<\/title>/i);
  assert.match(html, />SERIAL</);
  assert.match(html, /SEQUENTIAL EFFECTS LAB/);
  assert.match(html, /START SIGNAL/);
  assert.match(html, /SIGNAL GENERATOR/);
  assert.match(html, /EFFECT BAY/);
  assert.match(html, /WHY ORDER MATTERS/);
  assert.match(html, /WARM ECHO/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps every instrument state tied to real interaction and audio", async () => {
  const [page, engine, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/signal-chain-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../public/serial-og.png", import.meta.url)),
  ]);

  assert.match(engine, /createOscillator\(\)/);
  assert.match(engine, /createDynamicsCompressor\(\)/);
  assert.match(engine, /createAnalyser\(\)/);
  assert.match(engine, /createConvolver\(\)/);
  assert.match(engine, /setChain\(modules: EffectModule\[\]\)/);
  for (const effect of ["filter", "drive", "tremolo", "delay", "reverb"]) assert.match(engine, new RegExp(`${effect}: \\{`));

  assert.match(page, /data-snap-index/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /type="range"/);
  assert.match(page, /ArrowLeft/);
  assert.match(page, /Delete/);

  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(layout, /serial-og\.png/);
});
