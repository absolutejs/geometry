const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright",
);
(async () => {
  let browser;
  const errors = [];
  const watchdog = setTimeout(() => void browser?.close(), 30000);
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-gpu"],
    });
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    const dist = path.resolve(process.env.SUPPORT_DIST || "dist");
    await page.route("http://geometry.fixture/**", (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === "/worker.js")
        return r.fulfill({
          contentType: "text/javascript",
          body: `import {prepareUpwardSurface} from './index.js';let query;onmessage=e=>{try{if(e.data.input){query=prepareUpwardSurface(e.data.input);const {positions,indices}=e.data.input;postMessage({stats:query.stats,positions,indices},[positions.buffer,indices.buffer]);}else postMessage(query.query(...e.data.query));}catch(error){postMessage({error:String(error)})}};`,
        });
      if (
        /^\/[a-zA-Z0-9]+\.js$/.test(p) &&
        fs.existsSync(path.join(dist, p.slice(1)))
      )
        return r.fulfill({
          contentType: "text/javascript",
          body: fs.readFileSync(path.join(dist, p.slice(1))),
        });
      if (p === "/")
        return r.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Upward support worker</title>",
        });
      return r.abort();
    });
    await page.goto("http://geometry.fixture/");
    const result = await page.evaluate(async () => {
      const w = new Worker("/worker.js", { type: "module" });
      const call = (message, transfer = []) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error("worker timeout")), 5000);
          w.onmessage = (e) => {
            clearTimeout(timer);
            resolve(e.data);
          };
          w.onerror = (e) => {
            clearTimeout(timer);
            reject(Error(e.message));
          };
          w.postMessage(message, transfer);
        });
      try {
        const positions = new Float64Array([0, 1, 0, 0, 3, 4, 4, 2, 0]),
          indices = new Uint32Array([0, 1, 2]);
        const prepared = await call({ input: { positions, indices } }, [
          positions.buffer,
          indices.buffer,
        ]);
        const first = await call({ query: [1, 1, 1.8, 1] });
        const invalid = await call({
          input: {
            positions: new Float32Array([0, 0, 0]),
            indices: new Uint32Array([0, 1, 2]),
          },
        });
        const afterFailure = await call({ query: [1, 1, 1.8, 1] });
        return {
          detached: positions.byteLength === 0,
          returned: prepared.positions.length,
          stats: prepared.stats,
          first,
          invalid,
          afterFailure,
        };
      } finally {
        w.terminate();
      }
    });
    assert.equal(result.detached, true);
    assert.equal(result.returned, 9);
    assert.equal(result.first.hit.height, 1.75);
    assert.equal(result.first.hit.slopeX, 0.25);
    assert.equal(result.first.hit.slopeZ, 0.5);
    assert.equal(result.first.trianglesTested, 1);
    assert.match(result.invalid.error, /index/);
    assert.deepEqual(result.afterFailure, result.first);
    assert.deepEqual(errors, []);
    const hashes = Object.fromEntries(
      fs
        .readdirSync(dist)
        .filter((n) => n.endsWith(".js") || n.endsWith(".d.ts"))
        .map((n) => [
          n,
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(path.join(dist, n)))
            .digest("hex"),
        ]),
    );
    fs.writeFileSync(
      process.env.SUPPORT_OUT || "docs/upward-support-0.18.0/browser.json",
      JSON.stringify(
        {
          passed: true,
          result,
          errors,
          hashes,
          scope:
            "Browser module worker, transfer ownership and failed preparation; no GPU context",
        },
        null,
        2,
      ),
    );
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
