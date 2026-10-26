import {test,expect} from 'bun:test';
import Module from 'manifold-3d';
import {createManifoldPartitionKernel} from '../src/manifold';
import {partitionSolidMaterials,auditSurfaceOrigins,triangleWeights,mergeIndexedMesh,type OverlapMesh,type SurfaceOrigins} from '../src/index';
const wasm=await Module();wasm.setup();
type Solid=InstanceType<typeof wasm.Manifold>;
const exported=(s:Solid):OverlapMesh=>{const m=s.getMesh();return {positions:Float64Array.from(m.vertProperties),indices:m.triVerts.slice()};};
const cube=(offset=0)=>{const a=wasm.Manifold.cube([2,2,2],true);try{const m=exported(a);m.positions=m.positions.map((v,i)=>v+(i%3===0?offset:0));return m;}finally{a.delete();}};
const adapter=(count:number)=>createManifoldPartitionKernel(wasm,count);
test('partition retains verified source triangles and reversed internal interfaces',()=>{
 const inputs=[cube(),cube(1)],r=partitionSolidMaterials(inputs,adapter(2));
 expect(r.exterior.origins).not.toBeNull();
 expect(r.exterior.origins!.reversed.every(v=>v===0)).toBe(true);
 expect(r.cells[0]!.origins!.sources.every(v=>v===0)).toBe(true);
 const second=r.cells[1]!;
 expect(second.origins!.reversed.some(v=>v===1)).toBe(true);
 for(let t=0;t<second.origins!.faces.length;t++)
  if(second.origins!.reversed[t])expect(second.origins!.sources[t]).toBe(0);
 expect(auditSurfaceOrigins(second,second.origins!,inputs).reversedFaces).toBeGreaterThan(0);
});
test('false ancestry, flipped orientation and off-surface points are rejected',()=>{
 const inputs=[cube(),cube(1)],r=partitionSolidMaterials(inputs,adapter(2)),m=r.exterior,o=m.origins!;
 expect(()=>auditSurfaceOrigins(m,{...o,sources:new Uint16Array(o.sources.length).fill(3)},inputs)).toThrow('range');
 expect(()=>auditSurfaceOrigins(m,{...o,faces:new Uint32Array(o.faces.length).fill(999)},inputs)).toThrow('range');
 expect(()=>auditSurfaceOrigins(m,{...o,reversed:Uint8Array.from(o.reversed,v=>1-v)},inputs)).toThrow('winding');
 const moved={...m,positions:m.positions.map(v=>v+100)};
 expect(()=>auditSurfaceOrigins(moved,o,inputs)).toThrow();
 expect(()=>auditSurfaceOrigins(m,{...o,faces:new Uint32Array(0)},inputs)).toThrow('arrays');
 expect(()=>auditSurfaceOrigins(m,o,inputs,1)).toThrow('budget');
});
test('absent ancestry is explicit and copied metadata survives backend mutations',()=>{
 const input=cube(),k=adapter(1);let borrowed:SurfaceOrigins|undefined;
 const result=partitionSolidMaterials([input],{...k,mesh:s=>{const m=k.mesh(s);borrowed=m.origins;return m;}});
 borrowed!.faces.fill(999);
 expect(result.exterior.origins!.faces.every(f=>f<12)).toBe(true);
 const without=partitionSolidMaterials([input],{...adapter(1),mesh:exported});
 expect(without.exterior.origins).toBeNull();
});
test('thin-triangle attribute interpolation remains stable and rejects unrelated points',()=>{
 const a:[number,number,number]=[10,2,3],b:[number,number,number]=[11,2,3],c:[number,number,number]=[11,2.000001,3];
 const p=a.map((v,i)=>v*.2+b[i]!*.3+c[i]!*.5) as [number,number,number];
 triangleWeights(p,a,b,c).forEach((v,i)=>expect(v).toBeCloseTo([.2,.3,.5][i]!,7));
 expect(()=>triangleWeights([10,2,4],a,b,c)).toThrow('off surface');
 expect(()=>triangleWeights([12,2,3],a,b,c)).toThrow('outside');
 expect(()=>triangleWeights(a,a,a,a)).toThrow('Degenerate');
});

test('explicit merge ancestry restores shared topology without proximity welding',()=>{
 const m={numProp:3,vertProperties:new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0]),
  triVerts:new Uint32Array([0,1,2,3,2,1]),mergeFromVert:new Uint32Array([3]),mergeToVert:new Uint32Array([0])};
 const before=m.vertProperties.slice(),r=mergeIndexedMesh(m,[10,20,30],0);
 expect(r.positions.length).toBe(9);expect(r.indices[0]).toBe(r.indices[3]);
 expect(m.vertProperties).toEqual(before);
 const unmerged=mergeIndexedMesh({...m,mergeFromVert:new Uint32Array(),mergeToVert:new Uint32Array()},[0,0,0],0);
 expect(unmerged.positions.length).toBe(12);
 expect(()=>mergeIndexedMesh({...m,mergeToVert:new Uint32Array([99])},[0,0,0],0)).toThrow('merge map');
 expect(()=>mergeIndexedMesh({...m,mergeToVert:new Uint32Array([1])},[0,0,0],0)).toThrow('moved');
 expect(()=>mergeIndexedMesh(m,[NaN,0,0],0)).toThrow();
 expect(()=>mergeIndexedMesh(m,[0,0,0],NaN)).toThrow();
});
test('per-solid export rebasing preserves a tiny solid at a distant local offset',()=>{
 const a=wasm.Manifold.cube([1e-6,1e-6,1e-6],true),k=adapter(1);
 let source:Solid|undefined,moved:Solid|undefined;
 try {
  source=k.create(exported(a),0);moved=source.translate([3,2,1]);
  const raw=exported(moved),precise=k.mesh(moved);
  const width=(m:OverlapMesh)=>Math.max(...m.positions.filter((_,i)=>i%3===0))-Math.min(...m.positions.filter((_,i)=>i%3===0));
  expect(Math.abs(width(raw)/1e-6-1)).toBeGreaterThan(.01);
  expect(Math.abs(width(precise)/1e-6-1)).toBeLessThan(1e-7);
 }finally{moved?.delete();source?.delete();a.delete();}
});
