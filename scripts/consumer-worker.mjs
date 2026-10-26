import { parentPort } from 'node:worker_threads';
import { projectAlphaCoverage } from '../dist/index.js';
parentPort.once('message', input => {
  const result = projectAlphaCoverage(input);
  parentPort.postMessage(result, [result.cells.buffer]);
});
