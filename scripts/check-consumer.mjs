import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { projectAlphaCoverage, principalInertiaFrame } from '../dist/index.js';
const input = {
  positions: new Float64Array([0,0,0,1,0,0,0,0,1]),
  uv: new Float32Array([0,0,1,0,0,1]),
  indices: new Uint16Array([0,1,2]),
  alpha: new Uint8Array([255]), textureWidth:1, textureHeight:1,
  cutoff:0.4, resolution:64,
};
assert.equal(projectAlphaCoverage(input).coveredArea, 0.5);
const borrowed = input.positions.slice();
const worker = new Worker(new URL('./consumer-worker.mjs', import.meta.url));
try {
  const result = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error('worker deadline exceeded')), 5000);
    worker.once('message', value => { clearTimeout(deadline); resolve(value); });
    worker.once('error', error => { clearTimeout(deadline); reject(error); });
    worker.postMessage(input, [input.positions.buffer, input.uv.buffer, input.indices.buffer, input.alpha.buffer]);
  });
  assert.equal(input.positions.byteLength, 0);
  assert.equal(borrowed.byteLength, 72);
  assert.equal(result.coveredArea, 0.5);
  assert.equal(result.gapFraction, 0);
  assert.equal(result.cells.length, 4096);
  console.log('Built ESM import and transferable worker round trip passed');
} finally { await worker.terminate(); }

assert.deepEqual(principalInertiaFrame([3,1,0,1,3,0,0,0,4]).principal,[2,4,4]);
