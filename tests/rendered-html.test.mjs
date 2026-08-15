import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function html(path) {
  const response = await render(path);
  assert.equal(response.status, 200, `${path} should render 200`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const body = await response.text();
  assert.doesNotMatch(body, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  return body;
}

test("server-renders the field station index", async () => {
  const body = await html("/");
  assert.match(body, /<title>MZ Audio Tools<\/title>/i);
  assert.match(body, />MZ AUDIO TOOLS</);
  assert.match(body, />MAGPIE</);
  assert.match(body, />SERIAL</);
  assert.match(body, />ER·D</);
  assert.match(body, />FIELD CHORUS</);
  assert.match(body, /href="\/magpie"/);
  assert.match(body, /href="\/serial"/);
  assert.match(body, /href="\/erd"/);
  assert.match(body, /href="\/field-chorus"/);
});

test("server-renders Magpie at its own route", async () => {
  const body = await html("/magpie");
  assert.match(body, /<title>Magpie — Avian Signal Synthesizer<\/title>/i);
  assert.match(body, />MAGPIE</);
  assert.match(body, /AVIAN SIGNAL SYNTHESIZER/);
  assert.match(body, /MZ–01/);
});

test("server-renders Serial at its own route", async () => {
  const body = await html("/serial");
  assert.match(body, /<title>Serial — Sequential Effects Lab<\/title>/i);
  assert.match(body, />SERIAL</);
  assert.match(body, /SEQUENTIAL EFFECTS LAB/);
  assert.match(body, /START SIGNAL/);
  assert.match(body, /SIGNAL GENERATOR/);
  assert.match(body, /EFFECT BAY/);
  assert.match(body, /WHY ORDER MATTERS/);
  assert.match(body, /WARM ECHO/);
  assert.match(body, /MZ–02/);
});

test("server-renders Er·d at its own route", async () => {
  const body = await html("/erd");
  assert.match(body, />ER·D</);
  assert.match(body, /SIX VOICES/);
  assert.match(body, /SEQUENCE/);
  assert.match(body, /BOUNCE LOOP/);
  assert.match(body, /MZ–03/);
});

test("server-renders Field Chorus at its own route", async () => {
  const body = await html("/field-chorus");
  assert.match(body, /<title>Field Chorus — Mid-Atlantic Ecology Mixer<\/title>/i);
  assert.match(body, />FIELD CHORUS</);
  assert.match(body, /MID-ATLANTIC ECOLOGY MIXER/);
  assert.match(body, /AUTO ECOLOGY/);
  assert.match(body, /ECOLOGY MIXER/);
  assert.match(body, /MZ–07/);
});

test("keeps every instrument state tied to real interaction and audio", async () => {
  const [magpiePage, magpieEngine, serialPage, serialEngine, erdPage, erdEngine, fieldPage, fieldEngine, globalsCss] = await Promise.all([
    readFile(new URL("../app/magpie/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/magpie-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/serial/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/serial-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/erd/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/erd-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/field-chorus/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/field-chorus-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    access(new URL("../public/serial-og.png", import.meta.url)),
  ]);

  assert.match(magpieEngine, /createOscillator\(\)/);
  assert.match(magpiePage, /onPointerDown/);

  assert.match(serialEngine, /createOscillator\(\)/);
  assert.match(serialEngine, /createDynamicsCompressor\(\)/);
  assert.match(serialEngine, /createAnalyser\(\)/);
  assert.match(serialEngine, /createConvolver\(\)/);
  assert.match(serialEngine, /setChain\(modules: EffectModule\[\]\)/);
  for (const effect of ["filter", "drive", "tremolo", "delay", "reverb"]) assert.match(serialEngine, new RegExp(`${effect}: \\{`));
  assert.match(serialPage, /data-snap-index/);
  assert.match(serialPage, /onPointerDown/);
  assert.match(serialPage, /aria-live="polite"/);
  assert.match(serialPage, /type="range"/);
  assert.match(serialPage, /ArrowLeft/);
  assert.match(serialPage, /Delete/);

  assert.match(erdEngine, /createOscillator\(\)/);
  assert.match(erdEngine, /createBiquadFilter\(\)/);
  assert.match(erdPage, /role="slider"/);

  assert.match(fieldEngine, /createOscillator\(\)/);
  assert.match(fieldEngine, /createAnalyser\(\)/);
  assert.match(fieldEngine, /createDynamicsCompressor\(\)/);
  assert.match(fieldEngine, /ecologicalActivity/);
  assert.match(fieldPage, /AUTO ECOLOGY/);
  assert.match(fieldPage, /type="range"/);
  assert.match(fieldPage, /aria-live="polite"/);

  assert.match(globalsCss, /:focus-visible/);
  assert.match(globalsCss, /prefers-reduced-motion/);
});
