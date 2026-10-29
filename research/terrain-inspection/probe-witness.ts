/** Research only: existing installed BVH versus independent solid-angle oracle. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {closeRectangularPatch} from '../../src/closeRectangularPatch';
import {classifyMeshWitness} from '../../src/classifyMeshWitness';
import {solidPointMembership} from '../../src/solidPointMembership';
const game=resolve(process.argv[2]!),output=process.argv[3]!;
const threePath=game+'/node_modules/three/build/three.module.js',bvhPath=game+'/node_modules/three-mesh-bvh/src/index.js';
const THREE=await import(threePath),{MeshBVH}=await import(bvhPath);
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const inputs=[import.meta.path,'src/closeRectangularPatch.ts','src/classifyMeshWitness.ts','src/solidPointMembership.ts','tests/fixtures/terrain-inspection-patch.json.gz',threePath,bvhPath];
const sources=Object.fromEntries(inputs.map(p=>[p,sha(readFileSync(p))]));
const fixture=JSON.parse(gunzipSync(readFileSync('tests/fixtures/terrain-inspection-patch.json.gz')).toString());
const map:number[]=[],ids=new Map<string,number>(),values:number[]=[];
for(let i=0;i<fixture.positions.length;i+=3){const p=fixture.positions.slice(i,i+3),key=p.join(',');let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);values.push(...p);}map.push(id);}
const p=Float64Array.from(values),f=Uint32Array.from(fixture.indices.map((i:number)=>map[i]!));let low=Infinity,high=-Infinity;for(let i=1;i<p.length;i+=3){low=Math.min(low,p[i]!);high=Math.max(high,p[i]!);}
const construction=performance.now(),mesh=closeRectangularPatch(p,f,1,low-2),classify=classifyMeshWitness(mesh.positions,mesh.indices,mesh.sourceTriangleCount),oracle=solidPointMembership(mesh.positions,mesh.indices);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));
const before=sha(new Uint8Array(mesh.indices.buffer)),bvh=new MeshBVH(geometry,{indirect:true,maxLeafTris:8});if(sha(new Uint8Array(mesh.indices.buffer))!==before)throw Error('BVH changed source triangle identity');
const constructionMs=performance.now()-construction;
const points:{kind:string;point:[number,number,number]}[]=[];
for(let t=0;t<mesh.sourceTriangleCount;t+=Math.ceil(mesh.sourceTriangleCount/160)){
 const a=Array.from(p.slice(f[t*3]!*3,f[t*3]!*3+3)),b=Array.from(p.slice(f[t*3+1]!*3,f[t*3+1]!*3+3)),c=Array.from(p.slice(f[t*3+2]!*3,f[t*3+2]!*3+3));
 const u=b.map((x,k)=>x-a[k]!),v=c.map((x,k)=>x-a[k]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],length=Math.hypot(...n);
 for(const offset of [-.001,.001])points.push({kind:'near-source-face',point:a.map((x,k)=>(x+b[k]!+c[k]!)/3+offset*n[k]!/length) as [number,number,number]});
}
let state=0x21766521;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
for(let i=0;i<256;i++)points.push({kind:'bounded-volume',point:[fixture.bounds[0]+1+(fixture.bounds[1]-fixture.bounds[0]-2)*random(),low-1+(high-low+2)*random(),fixture.bounds[2]+1+(fixture.bounds[3]-fixture.bounds[2]-2)*random()]});
const rows=[];let queryMs=0,oracleMs=0;
try{for(const q of points){const started=performance.now(),nearest=bvh.closestPointToPoint(new THREE.Vector3(...q.point),{},0,Infinity);if(!nearest)throw Error('Unbounded nearest query missed');const result=classify(q.point,{point:nearest.point.toArray(),triangle:nearest.faceIndex});queryMs+=performance.now()-started;
 const began=performance.now(),expected=oracle(q.point);oracleMs+=performance.now()-began;
 rows.push({kind:q.kind,point:q.point,nearest:{point:nearest.point.toArray(),triangle:nearest.faceIndex,distance:nearest.distance},result,expected});
 if(process.memoryUsage().rss>1024**3)throw Error('Witness probe RSS exceeded');
}}finally{geometry.dispose();}
for(const[path,h]of Object.entries(sources))if(sha(readFileSync(path))!==h)throw Error('Probe source changed');
const mismatches=rows.filter(r=>r.result.kind==='known'&&r.result.classification!==r.expected),unknown=rows.filter(r=>r.result.kind==='unknown');
const result={scope:'Retained patch, CPU-only nearest witnesses; 1mm face offsets and seeded volume points; finite samples do not certify arbitrary self-intersection or continuous body separation',versions:{three:JSON.parse(readFileSync(game+'/node_modules/three/package.json','utf8')).version,bvh:JSON.parse(readFileSync(game+'/node_modules/three-mesh-bvh/package.json','utf8')).version},sources,constructionMs,queryMs,oracleMs,count:rows.length,mismatches:mismatches.length,unknown:unknown.length,unknownReasons:unknown.reduce((a,r)=>{const reason=(r.result as any).reason;a[reason]=(a[reason]??0)+1;return a;},{} as Record<string,number>),rows};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined,sources:undefined},null,2));if(mismatches.length)throw Error('Nearest witness disagrees with independent winding oracle');
