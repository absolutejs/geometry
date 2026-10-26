import {test,expect} from 'bun:test';
import Module from 'manifold-3d';
import {auditSolidOverlaps,type OverlapMesh} from '../src/index';
const wasm=await Module();wasm.setup();
function mesh(size:number,x=0,hole=0):OverlapMesh{
 const objects:InstanceType<typeof wasm.Manifold>[]=[];
 try{let s=wasm.Manifold.cube([size,size,size],true);objects.push(s);
 if(hole){const h=wasm.Manifold.cube([hole,hole,hole],true);objects.push(h);s=s.subtract(h);objects.push(s);}
 const m=s.getMesh();return{positions:Float64Array.from(m.vertProperties,(v,i)=>v+(i%3===0?x:0)),indices:m.triVerts.slice()};
 }finally{objects.reverse().forEach(o=>o.delete());}
}
const kernel={create:(m:OverlapMesh)=>new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:Float32Array.from(m.positions),triVerts:m.indices})),intersect:(a:InstanceType<typeof wasm.Manifold>,b:InstanceType<typeof wasm.Manifold>)=>a.intersect(b)};
test('initial overlap distinguishes duplicates, partial overlap, touching and disjoint solids',()=>{
 const a=mesh(2), b=mesh(2,1), c=mesh(2,2), d=mesh(2,10),before=a.positions.slice();
 const result=auditSolidOverlaps([a,a,b,c,d],kernel);
 expect(result.queries+result.boundsSkipped).toBe(10);
 expect(result.pairs.find(p=>p.a===0&&p.b===1)?.fractionOfSmaller).toBeCloseTo(1,10);
 expect(result.pairs.find(p=>p.a===0&&p.b===2)?.volume).toBeCloseTo(4,10);
 expect(result.pairs.some(p=>p.a===0&&p.b===3)).toBe(false);
 expect(a.positions).toEqual(before);
});
test('a chip inside a hollow shell has zero intersection, including large world translations',()=>{
 for(const x of [0,1e8]){
 const r=auditSolidOverlaps([mesh(4,x,2),mesh(1,x)],kernel);
 expect(r.queries).toBe(1);expect(r.pairs[0]!.volume).toBe(0);expect(r.volumes[0]).toBeCloseTo(56,10);expect(r.volumes[1]).toBeCloseTo(1,10);
 }
});
test('native handles are released on success, invalid output and kernel failure',()=>{
 for(const mode of ['success','create-failure','precision','intersect-failure','invalid-volume']){
 let allocated=0,deleted=0,creates=0;
 const make=(v:number)=>{allocated++;return{volume:()=>v,delete:()=>{deleted++;}};};
 const k={create:()=>{creates++;if(mode==='create-failure'&&creates===2)throw Error('kernel failed');return make(mode==='precision'?9:8);},intersect:()=>{if(mode==='intersect-failure')throw Error('kernel failed');return make(mode==='invalid-volume'?-1:8);}};
 if(mode==='success')expect(auditSolidOverlaps([mesh(2),mesh(2)],k).pairs[0]!.volume).toBe(8);
 else expect(()=>auditSolidOverlaps([mesh(2),mesh(2)],k)).toThrow();
 expect(deleted).toBe(allocated);
 }
});
test('budgets, orientation and corrupt meshes fail before unbounded kernel work',()=>{
 expect(()=>auditSolidOverlaps([mesh(2),mesh(2),mesh(2)],kernel,1)).toThrow('budget');
 const bad=mesh(2);for(let i=0;i<bad.indices.length;i+=3)[bad.indices[i],bad.indices[i+1]]=[bad.indices[i+1]!,bad.indices[i]!];
 expect(()=>auditSolidOverlaps([bad],kernel)).toThrow('volume');
 expect(()=>auditSolidOverlaps(Array(65).fill(mesh(2)),kernel)).toThrow('budget');
 expect(auditSolidOverlaps([],kernel).pairs).toEqual([]);
});
