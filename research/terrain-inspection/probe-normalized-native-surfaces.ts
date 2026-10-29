/** Independent inspection of recorded proxy vertices; no solver stepping or pose repair. */
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {closeRectangularPatch} from '../../src/closeRectangularPatch';
import {classifyMeshWitness} from '../../src/classifyMeshWitness';
import {auditDistanceTriangles} from '../../src/auditDistanceTriangles';
const [gameArg,fixtureArg,output]=process.argv.slice(2);if(!gameArg||!fixtureArg||!output)throw Error('Expected game directory, retained fixture and output');
const game=resolve(gameArg),input=resolve(fixtureArg),threePath=game+'/node_modules/three/build/three.module.js',bvhPath=game+'/node_modules/three-mesh-bvh/src/index.js';
const THREE=await import(threePath),{MeshBVH}=await import(bvhPath),bytes=readFileSync(input),fixture=JSON.parse(gunzipSync(bytes).toString());
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const sources=Object.fromEntries([import.meta.path,'src/closeRectangularPatch.ts','src/classifyMeshWitness.ts','src/auditDistanceTriangles.ts',input,threePath,bvhPath].map(p=>[p,sha(readFileSync(p))]));
const ground=fixture.ground,map:number[]=[],ids=new Map<string,number>(),values:number[]=[];
for(let i=0;i<ground.positions.length;i+=3){const p=ground.positions.slice(i,i+3),key=p.join(',');let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);values.push(...p);}map.push(id);}
const p=Float64Array.from(values),f=Uint32Array.from(ground.indices.map((i:number)=>map[i]!));let low=Infinity;for(let i=1;i<p.length;i+=3)low=Math.min(low,p[i]!);
const xs=values.filter((_,i)=>i%3===0),zs=values.filter((_,i)=>i%3===2),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
const buildStarted=performance.now(),mesh=closeRectangularPatch(p,f,1,low-2),classify=classifyMeshWitness(mesh.positions,mesh.indices,mesh.sourceTriangleCount);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));const indexHash=sha(new Uint8Array(mesh.indices.buffer)),bvh=new MeshBVH(geometry,{indirect:true,maxLeafTris:8});if(sha(new Uint8Array(mesh.indices.buffer))!==indexHash)throw Error('Source index changed');

const rapierPath=game+'/node_modules/@absolutejs/rapier3d/dist/rapier.mjs',shapePath=game+'/src/world/woodColliderShape.ts',runtimePath=game+'/src/tooling/rapierRuntime.ts';
for(const path of [rapierPath,shapePath,runtimePath])sources[path]=sha(readFileSync(path));
const {default:RAPIER}=await import(rapierPath),{woodColliderShape}=await import(shapePath),{initializeRapier}=await import(runtimePath);await initializeRapier();
const nativeWorld=new RAPIER.World({x:0,y:0,z:0}),rotation=new THREE.Quaternion(),queryPoint=new THREE.Vector3();
const maximumHullQueries=Number(process.argv[5]??20000);if(!Number.isSafeInteger(maximumHullQueries)||maximumHullQueries<1||maximumHullQueries>100000)throw Error('Invalid hull query budget');
const rows=[];let queries=0;const began=performance.now();
try{for(let body=0;body<fixture.models.length;body++){
 const pose=fixture.result.drops[body].poses.at(-1);rotation.fromArray(pose.rotation);
 for(const [collider,frame]of fixture.models[body].colliders.entries()){
  const desc=woodColliderShape(Float32Array.from(frame.solverPoints));if(!desc)throw Error('Missing native collider descriptor');
  const native=nativeWorld.createCollider(desc);let rawPositions:Float32Array,rawIndices:Uint32Array;
  try{rawPositions=native.vertices();rawIndices=native.indices();if(!rawPositions||!rawIndices)throw Error('Missing normalized native hull export');}finally{nativeWorld.removeCollider(native,false);}
  const positions:number[]=[],indices=Array.from(rawIndices);
  for(let i=0;i<rawPositions.length;i+=3){const point=new THREE.Vector3(rawPositions[i]!/100+frame.origin[0],rawPositions[i+1]!/100+frame.origin[1],rawPositions[i+2]!/100+frame.origin[2]).applyQuaternion(rotation).add(new THREE.Vector3(...pose.position));positions.push(point.x,point.y,point.z);}
  if(indices.length%3)throw Error('Nontriangular hull');
  if(queries>=250000||performance.now()-began>180000)throw Error('Surface probe budget exhausted');
  const start=performance.now();
  const result=auditDistanceTriangles(Float64Array.from(positions),Uint32Array.from(indices),point=>{
   queryPoint.fromArray(point);const nearest=bvh.closestPointToPoint(queryPoint,{},0,Infinity);if(!nearest)throw Error('Missing nearest witness');
   const value=classify(point,{point:nearest.point.toArray(),triangle:nearest.faceIndex});return value.kind==='known'?{kind:'known',signedDistance:value.signedDistance,errorBound:1e-7}:{kind:'unknown'};
  },{penetrationTolerance:.005,maximumQueries:Math.min(maximumHullQueries,250000-queries),maximumDepth:24,roundoffPadding:1e-8});
  queries+=result.queries;rows.push({body,collider,poseSeconds:pose.seconds,sourceVertices:frame.solverPoints.length/3,exportVertices:rawPositions.length/3,exportPositionsSha256:sha(new Uint8Array(rawPositions.buffer,rawPositions.byteOffset,rawPositions.byteLength)),exportIndicesSha256:sha(new Uint8Array(rawIndices.buffer,rawIndices.byteOffset,rawIndices.byteLength)),surfaceTriangles:indices.length/3,elapsedMs:performance.now()-start,result});
 }
}}finally{geometry.dispose();nativeWorld.free();}
for(const[path,h]of Object.entries(sources))if(sha(readFileSync(path))!==h)throw Error('Input changed');
const result={scope:'Terminal-pose published Rapier normalized convex export surface audit, 5mm tolerance; export recomputes the hull and is NOT literal stored topology, continuous motion or enclosed-volume certification. Unknown budget exhaustion never clears a hull.',maximumHullQueries,sources,elapsedMs:performance.now()-began,queries,clear:rows.filter(r=>r.result.kind==='clear').length,penetrating:rows.filter(r=>r.result.kind==='penetrating').length,unknown:rows.filter(r=>r.result.kind==='unknown').length,rows};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,sources:undefined},null,2));
