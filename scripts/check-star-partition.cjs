const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  chromium,
} = require("/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright");
(async () => {
  let browser;
  const watchdog = setTimeout(() => void browser?.close(), 30000);
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-gpu", "--disable-webgl"],
    });
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const dist = path.resolve(process.env.STAR_DIST || "dist");
    await page.route("http://geometry.fixture/**", (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === "/worker.js")
        return r.fulfill({
          contentType: "text/javascript",
          body: `import {partitionStarShapedMesh} from './index.js';onmessage=e=>{try{const p=partitionStarShapedMesh(e.data.mesh,e.data.kernel);postMessage(p,p.pieces.flatMap(p=>[p.positions.buffer,p.indices.buffer]));}catch(error){postMessage({error:String(error)});}}`,
        });
      if (
        /^\/[a-zA-Z0-9]+\.js$/.test(p) &&
        fs.existsSync(path.join(dist, p.slice(1)))
      )
        return r.fulfill({
          contentType: "text/javascript",
          body: fs.readFileSync(path.join(dist, p.slice(1)), "utf8"),
        });
      if (p === "/")
        return r.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Star partition worker</title>",
        });
      return r.abort();
    });
    await page.goto("http://geometry.fixture/");
    const result = await page.evaluate(async () => {
      const worker = new Worker("/worker.js", { type: "module" });
      const query = (mesh, kernel) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(Error("worker deadline")),
            5000,
          );
          worker.onmessage = (e) => {
            clearTimeout(timer);
            resolve(e.data);
          };
          worker.onerror = (e) => {
            clearTimeout(timer);
            reject(Error(e.message));
          };
          worker.postMessage({ mesh, kernel }, [
            mesh.positions.buffer,
            mesh.indices.buffer,
          ]);
        });
      try {
        const mesh = {
          positions: new Float64Array([
            -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1,
            0.2, 0.2, 0.2, -1, 1, 1,
          ]),
          indices: new Uint32Array([
            0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6,
            5, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
          ]),
        };
        const original = {
            positions: mesh.positions.slice(),
            indices: mesh.indices.slice(),
          },
          good = await query(mesh, [0, 0, 0]);
        const bad = await query(original, [2, 2, 2]);
        return {
          pieces: good.pieces.length,
          volume: good.volume,
          clearance: good.minimumKernelClearance,
          sourceTriangles: good.pieces.map((p) => p.sourceTriangle),
          float64: good.pieces.every(
            (p) => p.positions instanceof Float64Array,
          ),
          indices32: good.pieces.every((p) => p.indices instanceof Uint32Array),
          inputDetached:
            mesh.positions.byteLength === 0 && mesh.indices.byteLength === 0,
          rejection: bad.error,
        };
      } finally {
        worker.terminate();
      }
    });
    assert.equal(result.pieces, 12);
    assert(result.volume > 0 && result.volume < 8);
    assert(result.clearance > 0);
    assert.deepEqual(
      result.sourceTriangles,
      Array.from({ length: 12 }, (_, i) => i),
    );
    assert(result.float64 && result.indices32 && result.inputDetached);
    assert.match(result.rejection, /Kernel/);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          result,
          errors,
          scope:
            "Built ESM browser worker, transferred Float64 inputs/outputs, rejected invalid kernel; GPU/WebGL disabled",
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
