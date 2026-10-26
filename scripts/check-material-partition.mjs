import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { partitionSolidMaterials } from '../dist/index.js';
const wasm=await Module();wasm.setup();
const mesh=s=>{const m=s.getMesh();return {positions:Float64Array.from(m.vertProperties),indices:m.triVerts.slice()};};
const a=wasm.Manifold.cube([2,2,2],true),b=a.translate([1,0,0]);
try {
 const result=partitionSolidMaterials([mesh(a),mesh(b)],{
  create:m=>new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(m.positions),triVerts:m.indices})),
  subtract:(x,y)=>x.subtract(y),union:(x,y)=>x.add(y),mesh,
 });
 assert.equal(result.materialVolume,12);
 assert.deepEqual(result.cells.map(c=>c.volume),[8,4]);
 console.log(JSON.stringify({runtime:process.version,materialVolume:result.materialVolume,cells:result.cells.map(c=>c.volume),operations:result.operations}));
}finally{a.delete();b.delete();}
