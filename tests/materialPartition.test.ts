import {test,expect} from 'bun:test';
import Module from 'manifold-3d';
import {partitionSolidMaterials,type OverlapMesh} from '../src/index';
const wasm=await Module();wasm.setup();
type Solid=InstanceType<typeof wasm.Manifold>;
function exported(s:Solid):OverlapMesh {
 const m=s.getMesh();
 if(m.numProp!==3) throw Error('Unexpected fixture properties');
 return {positions:Float64Array.from(m.vertProperties),indices:m.triVerts.slice()};
}
function cube(size:number,xyz=[0,0,0],hole=0):OverlapMesh {
 const held:Solid[]=[];
 try {
  let s=wasm.Manifold.cube([size,size,size],true);held.push(s);
  if(hole){const h=wasm.Manifold.cube([hole,hole,hole],true);held.push(h);s=s.subtract(h);held.push(s);}
  const m=exported(s);
  m.positions=m.positions.map((v,i)=>v+xyz[i%3]!);
  return m;
 } finally {held.reverse().forEach(s=>s.delete());}
}
const kernel={
 create:(m:OverlapMesh)=>new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(m.positions),triVerts:m.indices})),
 subtract:(a:Solid,b:Solid)=>a.subtract(b),
 union:(a:Solid,b:Solid)=>a.add(b),
 mesh:exported,
};
test('ordered material cells remove duplicated volume and keep a distinct exterior',()=>{
 const a=cube(2),b=cube(2,[1,0,0]),before=a.positions.slice();
 const r=partitionSolidMaterials([a,b],kernel);
 expect(r.inputVolumes).toEqual([8,8]);
 expect(r.cells.map(c=>c.volume)).toEqual([8,4]);
 expect(r.materialVolume).toBe(12);expect(r.volumeDifference).toBe(4);
 expect(r.operations).toBe(2);expect(r.cells.map(c=>c.source)).toEqual([0,1]);
 const reversed=partitionSolidMaterials([b,a],kernel);
 expect(reversed.cells.map(c=>c.volume)).toEqual([8,4]);
 expect(reversed.materialVolume).toBe(12);
 expect(a.positions).toEqual(before);
 const solids=r.cells.map(c=>kernel.create(c));
 const overlap=solids[0]!.intersect(solids[1]!);
 try{expect(overlap.volume()).toBe(0);}finally{overlap.delete();solids.forEach(s=>s.delete());}
});
test('full coverage returns an explicit empty source cell, not a duplicate solid',()=>{
 const r=partitionSolidMaterials([cube(2),cube(1)],kernel);
 expect(r.cells[1]!.source).toBe(1);expect(r.cells[1]!.volume).toBe(0);
 expect(r.cells[1]!.positions.length).toBe(0);expect(r.cells[1]!.indices.length).toBe(0);
 expect(r.materialVolume).toBe(8);expect(r.volumeDifference).toBe(1);
});
test('hollow material, disconnected solids and large translations preserve physical volume',()=>{
 for(const x of [0,1e8]){
  const r=partitionSolidMaterials([cube(4,[x,0,0],2),cube(1,[x,0,0]),cube(1,[x+10,0,0])],kernel);
  expect(r.materialVolume).toBeCloseTo(58,8);
  [56,1,1].forEach((v,i)=>expect(r.cells[i]!.volume).toBeCloseTo(v,10));
  expect(r.volumeDifference).toBeCloseTo(0,8);
 }
});
test('face, edge and point contact do not assign duplicated volume',()=>{
 for(const offset of [[2,0,0],[2,2,0],[2,2,2]]){
  const r=partitionSolidMaterials([cube(2),cube(2,offset)],kernel);
  expect(r.materialVolume).toBeCloseTo(16,10);r.cells.forEach(c=>expect(c.volume).toBeCloseTo(8,10));
 }
});
test('success and each native failure release all successfully returned handles',()=>{
 for(const mode of ['success','create','subtract','union','mesh']){
  let created=0,deleted=0,createCalls=0;
  const track=(s:Solid)=>{
   created++;const release=s.delete.bind(s);
   s.delete=()=>{deleted++;release();};return s;
  };
  const wrapped={
   create:(m:OverlapMesh)=>{if(mode==='create'&&++createCalls===2)throw Error('injected create');return track(kernel.create(m));},
   subtract:(a:Solid,b:Solid)=>{if(mode==='subtract')throw Error('injected subtract');return track(a.subtract(b));},
   union:(a:Solid,b:Solid)=>{if(mode==='union')throw Error('injected union');return track(a.add(b));},
   mesh:(s:Solid)=>{if(mode==='mesh')throw Error('injected mesh');return exported(s);},
  };
  if(mode==='success')expect(partitionSolidMaterials([cube(2),cube(2,[1,0,0])],wrapped).materialVolume).toBe(12);
  else expect(()=>partitionSolidMaterials([cube(2),cube(2,[1,0,0])],wrapped)).toThrow('injected');
  expect(deleted).toBe(created);
 }
});
test('invalid budgets and geometry fail before native allocation',()=>{
 let creates=0;const k={...kernel,create:(m:OverlapMesh)=>{creates++;return kernel.create(m);}};
 for(const inputs of [[],Array(65).fill(cube(1)),[{positions:new Float64Array(),indices:new Uint32Array()}]])
  expect(()=>partitionSolidMaterials(inputs,k)).toThrow();
 expect(()=>partitionSolidMaterials([cube(1),cube(1)],k,1)).toThrow('budget');
 const bad=cube(1);bad.indices[0]=999;
 expect(()=>partitionSolidMaterials([bad],k)).toThrow();
 expect(creates).toBe(0);
});
test('host mutation of copied input arrays cannot change caller geometry',()=>{
 const input=cube(2),positions=input.positions.slice(),indices=input.indices.slice();
 const k={...kernel,create:(m:OverlapMesh)=>{const s=kernel.create(m);m.positions.fill(999);m.indices.fill(999);return s;}};
 expect(partitionSolidMaterials([input],k).materialVolume).toBe(8);
 expect(input.positions).toEqual(positions);expect(input.indices).toEqual(indices);
});

test('incorrect native operations and aliased handles cannot pass conservation',()=>{
 const inputs=[cube(2),cube(2,[1,0,0])];
 expect(()=>partitionSolidMaterials(inputs,{...kernel,subtract:a=>kernel.create(exported(a))})).toThrow('precision');
 expect(()=>partitionSolidMaterials(inputs,{...kernel,subtract:a=>a})).toThrow('fresh handles');
 expect(()=>partitionSolidMaterials(inputs,{...kernel,mesh:()=>({positions:new Float64Array(600003),indices:new Uint32Array()})})).toThrow('output budget');
});
test('sequential cuts preserve the independent whole-union mass',()=>{
 const r=partitionSolidMaterials([cube(2),cube(2,[1,0,0])],kernel);
 let pieces=r.cells.map(kernel.create),whole=kernel.create(r.exterior);
 const held:Solid[]=[...pieces,whole];
 try{
  for(const half of [.1,.3,1]){
   const tool=wasm.Manifold.cube([2*half,2*half,2*half],true);held.push(tool);
   let removed=0;
   pieces=pieces.map(s=>{const chip=s.intersect(tool),rest=s.subtract(tool);held.push(chip,rest);removed+=chip.volume();return rest;});
   const chip=whole.intersect(tool),rest=whole.subtract(tool);held.push(chip,rest);
   expect(removed).toBeCloseTo(chip.volume(),10);
   expect(pieces.reduce((n,s)=>n+s.volume(),0)).toBeCloseTo(rest.volume(),10);
   whole=rest;
  }
 }finally{held.reverse().forEach(s=>s.delete());}
});

test('native lifetime stays bounded as source count grows',()=>{
 let live=0,peak=0;
 const own=(s:Solid)=>{live++;peak=Math.max(peak,live);const dispose=s.delete.bind(s);s.delete=()=>{live--;dispose();};return s;};
 const k={create:(m:OverlapMesh)=>own(kernel.create(m)),subtract:(a:Solid,b:Solid)=>own(a.subtract(b)),union:(a:Solid,b:Solid)=>own(a.add(b)),mesh:exported};
 const r=partitionSolidMaterials(Array.from({length:12},(_,i)=>cube(2,[i,0,0])),k);
 expect(r.materialVolume).toBeCloseTo(52,10);
 expect(live).toBe(0);expect(peak).toBeLessThanOrEqual(3);
});
