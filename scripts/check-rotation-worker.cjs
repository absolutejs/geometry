const {
  chromium,
} = require("/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const source = `import {firstRotationPlaneContact} from '/dist/rotationPlane.js';self.onmessage=e=>{try {self.postMessage({value:firstRotationPlaneContact(e.data)});}catch(error){self.postMessage({error:String(error)});}};`;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/worker.js")
        return new Response(source, {
          headers: { "content-type": "text/javascript" },
        });
      if (path === "/dist/rotationPlane.js")
        return new Response(Bun.file("dist/rotationPlane.js"), {
          headers: { "content-type": "text/javascript" },
        });
      return new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      });
    },
  });
  let browser;
  const errors = [];
  const timer = setTimeout(() => void browser?.close(), 20000);
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-gpu"],
    });
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(server.url.href);
    const result = await page.evaluate(async () => {
      const worker = new Worker("/worker.js", { type: "module" });
      const send = (q) =>
        new Promise((resolve, reject) => {
          worker.onmessage = (e) => resolve(e.data);
          worker.onerror = (e) => reject(Error(e.message));
          worker.postMessage(q, [q.positions.buffer]);
        });
      const make = (p) => ({
        positions: Float64Array.from(p),
        pivot: [0, 0, 0],
        axis: [0, 0, 1],
        plane: { normal: [0, 1, 0], constant: 0 },
        maxAngle: 2 * Math.PI,
      });
      try {
        const query = make([-1, 1, 0]),
          contact = await send(query),
          detached = query.positions.byteLength === 0;
        const rejected = await send({ ...make([0, 0, 0]), axis: [0, 0, 0] });
        const near = await send(make([-1, 1e-18, 0]));
        const clear = await send({ ...make([0, 2, 0]), axis: [0, 1, 0] });
        return { contact, detached, rejected, near, clear };
      } finally {
        worker.terminate();
      }
    });
    assert.equal(result.detached, true);
    assert.equal(result.contact.value.status, "contact");
    assert(Math.abs(result.contact.value.angle - Math.PI / 4) < 1e-12);
    assert.match(result.rejected.error, /Degenerate/);
    assert.equal(result.near.value.status, "contact");
    assert(result.near.value.angle > 0);
    assert(Math.abs(result.near.value.angle / 1e-18 - 1) < 1e-12);
    assert.equal(result.clear.value.status, "clear");
    assert.deepEqual(errors, []);
    fs.mkdirSync("docs/rotation-plane-2026-11-06", { recursive: true });
    fs.writeFileSync(
      "docs/rotation-plane-2026-11-06/browser.json",
      JSON.stringify(
        {
          result,
          errors,
          scope:
            "Bounded GPU-disabled browser worker; transferred input, invalid-query recovery, near-zero and no-contact controls. No rendering or FPS claim.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log({ controls: 4, detached: result.detached, errors });
  } finally {
    clearTimeout(timer);
    await browser?.close();
    server.stop(true);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
