/** Independent inspection of recorded proxy vertices; no solver stepping or pose repair. */
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {closeRectangularPatch} from '../../src/closeRectangularPatch';
import {classifyMeshWitness} from '../../src/classifyMeshWitness';
import {solidPointMembership} from '../../src/solidPointMembership';
const [gameArg,fixtureArg,output]=process.argv.slice(2);if(!gameArg||!fixtureArg||!output)throw Error('Expected game directory, retained fixture and output');
const game=resolve(gameArg),input=resolve(fixtureArg),threePath=game+'/node_modules/three/build/three.module.js',bvhPath=game+'/node_modules/three-mesh-bvh/src/index.js';
const THREE=await import(threePath),{MeshBVH}=await import(bvhPath),bytes=readFileSync(input),fixture=JSON.parse(gunzipSync(bytes).toString());
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const sources=Object.fromEntries([import.meta.path,'src/closeRectangularPatch.ts','src/classifyMeshWitness.ts','src/solidPointMembership.ts',input,threePath,bvhPath].map(p=>[p,sha(readFileSync(p))]));
const ground=fixture.ground,map:number[]=[],ids=new Map<string,number>(),values:number[]=[];
for(let i=0;i<ground.positions.length;i+=3){const p=ground.positions.slice(i,i+3),key=p.join(',');let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);values.push(...p);}map.push(id);}
const p=Float64Array.from(values),f=Uint32Array.from(ground.indices.map((i:number)=>map[i]!));let low=Infinity;for(let i=1;i<p.length;i+=3)low=Math.min(low,p[i]!);
const buildStarted=performance.now(),mesh=closeRectangularPatch(p,f,1,low-2),classify=classifyMeshWitness(mesh.positions,mesh.indices,mesh.sourceTriangleCount),oracle=solidPointMembership(mesh.positions,mesh.indices);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));const indexHash=sha(new Uint8Array(mesh.indices.buffer)),bvh=new MeshBVH(geometry,{indirect:true,maxLeafTris:8});if(sha(new Uint8Array(mesh.indices.buffer))!==indexHash)throw Error('Source index changed');
const buildMs=performance.now()-buildStarted,started=performance.now(),world=new THREE.Vector3(),rotation=new THREE.Quaternion();
let queries=0,queryMs=0,oracleMs=0,known=0,unknown=0,minimum=Infinity,minimumWitness:unknown=null,plannedSkips=0,boundViolations=0,signMismatches=0,bruteMismatches=0;
const unknownExamples:unknown[]=[],oracleRows:unknown[]=[],bodies:unknown[]=[];
const save=(status:string)=>{writeFileSync(output+'.next',JSON.stringify({scope:'All retained replay endpoints and source collider proxy vertices; not native hull export, authored-material surface or continuous trajectory certification. Temporal skips are compared to exact queries here, not executed as a speedup.',status,sources,buildMs,elapsedMs:performance.now()-started,queries,queryMs,oracleMs,known,unknown,minimum:Number.isFinite(minimum)?minimum:null,minimumWitness,plannedSkips,boundViolations,signMismatches,bruteMismatches,unknownExamples,oracleRows,bodies},null,2)+'\n');renameSync(output+'.next',output);};
try{for(let body=0;body<fixture.models.length;body++){
 const model=fixture.models[body],drop=fixture.result.drops[body],vertices:{source:[number,number,number];bound:number|null;previous:[number,number,number]|null}[]=[];
 for(const frame of model.colliders)for(let i=0;i<frame.solverPoints.length;i+=3)vertices.push({source:[frame.solverPoints[i]/100+frame.origin[0],frame.solverPoints[i+1]/100+frame.origin[1],frame.solverPoints[i+2]/100+frame.origin[2]],bound:null,previous:null});
 let bodyMin=Infinity,bodyUnknown=0;
 for(let poseIndex=0;poseIndex<drop.poses.length;poseIndex++){
  const pose=drop.poses[poseIndex];rotation.fromArray(pose.rotation);
  for(const [vertexIndex,vertex]of vertices.entries()){
   world.fromArray(vertex.source).applyQuaternion(rotation);world.x+=pose.position[0];world.y+=pose.position[1];world.z+=pose.position[2];const point=world.toArray() as [number,number,number];
   const began=performance.now(),nearest=bvh.closestPointToPoint(world,{},0,Infinity);if(!nearest)throw Error('Nearest point missing');const result=classify(point,{point:nearest.point.toArray(),triangle:nearest.faceIndex});queryMs+=performance.now()-began;queries++;
   const previous=vertex.previous,bound=previous&&vertex.bound!==null?vertex.bound-Math.hypot(...point.map((x,k)=>x-previous[k]!)):null;
   if(bound!==null&&bound>1e-6){plannedSkips++;if(nearest.distance+1e-7<bound||(result.kind==='known'&&result.classification!=='outside'))boundViolations++;vertex.bound=bound;}
   else vertex.bound=result.kind==='known'?result.signedDistance:null;vertex.previous=point;
   if(result.kind==='known'){known++;bodyMin=Math.min(bodyMin,result.signedDistance);if(result.signedDistance<minimum){minimum=result.signedDistance;minimumWitness={body,poseIndex,seconds:pose.seconds,vertexIndex,point,nearest:{point:nearest.point.toArray(),triangle:nearest.faceIndex,distance:nearest.distance},result};}}
   else{unknown++;bodyUnknown++;if(unknownExamples.length<12)unknownExamples.push({body,poseIndex,vertexIndex,point,result});}
   if(queries%4096===0){const began=performance.now(),expected=oracle(point);oracleMs+=performance.now()-began;if(result.kind==='known'&&result.classification!==expected)signMismatches++;oracleRows.push({body,poseIndex,vertexIndex,point,result,expected});}
   if(queries%32768===0){const tri=new THREE.Triangle(),target=new THREE.Vector3();let best=Infinity;for(let t=0;t<mesh.indices.length;t+=3){tri.a.fromArray(mesh.positions,mesh.indices[t]!*3);tri.b.fromArray(mesh.positions,mesh.indices[t+1]!*3);tri.c.fromArray(mesh.positions,mesh.indices[t+2]!*3);tri.closestPointToPoint(world,target);best=Math.min(best,world.distanceTo(target));}if(Math.abs(best-nearest.distance)>1e-7)bruteMismatches++;}
   if(queries>500000||performance.now()-started>180000)throw Error('Trajectory inspection budget exceeded');
  }
  if(poseIndex%128===0){save('running');if(process.memoryUsage().rss>1024**3)throw Error('RSS budget exceeded');}
 }
 bodies.push({body,proxyVertices:vertices.length,poses:drop.poses.length,minimum:bodyMin,unknown:bodyUnknown});save('running');
}}catch(error){save('failed');throw error;}finally{geometry.dispose();}
for(const[path,h]of Object.entries(sources))if(sha(readFileSync(path))!==h)throw Error('Input changed');save('completed');
console.log(JSON.stringify({queries,queryMs,oracleMs,known,unknown,minimum,plannedSkips,boundViolations,signMismatches,bruteMismatches,bodies},null,2));if(signMismatches||bruteMismatches||boundViolations)throw Error('Independent trajectory validation failed');
