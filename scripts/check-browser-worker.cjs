const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('http://geometry.fixture/**', route => {
      const path = new URL(route.request().url()).pathname;
      const sources = {
        '/index.js': fs.readFileSync('dist/index.js', 'utf8'),
        '/projection.js': fs.readFileSync('dist/projection.js', 'utf8'),
        '/worker.js': `import {projectAlphaCoverage} from './index.js'; onmessage = e => { try {const r = projectAlphaCoverage(e.data); postMessage(r,[r.cells.buffer]);} catch (error) {postMessage({error:String(error)});} };`,
      };
      return route.fulfill({contentType: path in sources ? 'text/javascript' : 'text/html', body: sources[path] || '<!doctype html><title>Geometry worker qualification</title>'});
    });
    await page.goto('http://geometry.fixture/');
    const result = await page.evaluate(async () => {
      const worker = new Worker('/worker.js', { type: 'module' });
      try {
        const positions = new Float64Array([0,0,0,1,0,0,0,0,1]);
        const reply = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('worker deadline')), 5000);
          worker.onmessage = e => {clearTimeout(timer);resolve(e.data)};
          worker.onerror = e => {clearTimeout(timer);reject(Error(e.message))};
          worker.postMessage({positions, uv:new Float32Array([0,0,1,0,0,1]),indices:new Uint16Array([0,1,2]),alpha:new Uint8Array([255]),textureWidth:1,textureHeight:1,cutoff:0.4,resolution:64},[positions.buffer]);
        });
        return {area:reply.coveredArea,gap:reply.gapFraction,cells:reply.cells.length,detached:positions.byteLength===0};
      } finally {worker.terminate()}
    });
    assert.deepEqual(result,{area:0.5,gap:0,cells:4096,detached:true});
    assert.deepEqual(errors,[]);
    fs.mkdirSync('.diagnostics',{recursive:true});
    fs.writeFileSync('.diagnostics/browser-worker.json',JSON.stringify({result,errors,gpu:'disabled'},null,2));
    console.log('GPU-disabled browser module worker passed',result);
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
