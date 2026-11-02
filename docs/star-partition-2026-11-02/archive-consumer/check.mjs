import assert from 'node:assert/strict';
import {partitionStarShapedMesh} from '@absolutejs/geometry';
const result=partitionStarShapedMesh({positions:new Float64Array([0,0,0,1,0,0,0,1,0,0,0,1]),indices:new Uint32Array([1,2,3,0,2,1,0,3,2,0,1,3])},[.25,.25,.25]);
assert.equal(result.pieces.length,4);assert(Math.abs(result.volume-1/6)<1e-15);assert.deepEqual(result.origin,[.25,.25,.25]);console.log(JSON.stringify({archiveImport:true,pieces:result.pieces.length,volume:result.volume}));
