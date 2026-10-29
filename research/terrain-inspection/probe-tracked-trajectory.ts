/** Independent inspection of recorded proxy vertices; no solver stepping or pose repair. */
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {closeRectangularPatch} from '../../src/closeRectangularPatch';
import {classifyMeshWitness} from '../../src/classifyMeshWitness';
import {createStaticDistanceTracker} from '../../src/staticDistanceTracker';
const [gameArg,fixtureArg,output]=process.argv.slice(2);if(!gameArg||!fixtureArg||!output)throw Error('Expected game directory, retained fixture and output');
const game=resolve(gameArg),input=resolve(fixtureArg),threePath=game+'/node_modules/three/build/three.module.js',bvhPath=game+'/node_modules/three-mesh-bvh/src/index.js';
const THREE=await import(threePath),{MeshBVH}=await import(bvhPath),bytes=readFileSync(input),fixture=JSON.parse(gunzipSync(bytes).toString());
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const sources=Object.fromEntries([import.meta.path,'src/closeRectangularPatch.ts','src/classifyMeshWitness.ts','src/staticDistanceTracker.ts',input,threePath,bvhPath].map(p=>[p,sha(readFileSync(p))]));
const ground=fixture.ground,map:number[]=[],ids=new Map<string,number>(),values:number[]=[];
for(let i=0;i<ground.positions.length;i+=3){const p=ground.positions.slice(i,i+3),key=p.join(',');let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);values.push(...p);}map.push(id);}
const p=Float64Array.from(values),f=Uint32Array.from(ground.indices.map((i:number)=>map[i]!));let low=Infinity;for(let i=1;i<p.length;i+=3)low=Math.min(low,p[i]!);
const xs=values.filter((_,i)=>i%3===0),zs=values.filter((_,i)=>i%3===2),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
const buildStarted=performance.now(),mesh=closeRectangularPatch(p,f,1,low-2),classify=classifyMeshWitness(mesh.positions,mesh.indices,mesh.sourceTriangleCount);
const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));geometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));const indexHash=sha(new Uint8Array(mesh.indices.buffer)),bvh=new MeshBVH(geometry,{indirect:true,maxLeafTris:8});if(sha(new Uint8Array(mesh.indices.buffer))!==indexHash)throw Error('Source index changed');
const referencePath=resolve(process.argv[5]!),reference=JSON.parse(readFileSync(referencePath,'utf8')),encoded=readFileSync(referencePath+'.distances.f64.gz'),referenceBytes=gunzipSync(encoded);
if(reference.status!=='completed'||reference.signMismatches!==0||reference.bruteMismatches!==0||reference.boundViolations!==0||sha(referenceBytes)!==reference.reference.rawSha256||sha(encoded)!==reference.reference.archiveSha256)throw Error('Invalid exact reference');
sources[referencePath]=sha(readFileSync(referencePath));sources[referencePath+'.distances.f64.gz']=sha(encoded);
const referenceView=new DataView(referenceBytes.buffer,referenceBytes.byteOffset,referenceBytes.byteLength),pointHash=createHash('sha256'),pointBytes=Buffer.alloc(24);
const buildMs=performance.now()-buildStarted,started=performance.now(),world=new THREE.Vector3(),rotation=new THREE.Quaternion(),queryPoint=new THREE.Vector3();
let points=0,oracleQueries=0,propagated=0,unknowns=0,violations=0,minimum=Infinity,queryMs=0;const bodies=[];
try{for(let body=0;body<fixture.models.length;body++){
 const vertices:[number,number,number][]=[];for(const frame of fixture.models[body].colliders)for(let i=0;i<frame.solverPoints.length;i+=3)vertices.push([frame.solverPoints[i]/100+frame.origin[0],frame.solverPoints[i+1]/100+frame.origin[1],frame.solverPoints[i+2]/100+frame.origin[2]]);
 const tracker=createStaticDistanceTracker(point=>{const began=performance.now();queryPoint.fromArray(point);const nearest=bvh.closestPointToPoint(queryPoint,{},0,Infinity);if(!nearest)throw Error('Nearest point missing');const result=classify(point,{point:nearest.point.toArray(),triangle:nearest.faceIndex});queryMs+=performance.now()-began;return result;},{maximumPoints:vertices.length,roundoffPadding:1e-7,withinDomain:([x,y,z])=>x>xmin&&x<xmax&&z>zmin&&z<zmax&&y>mesh.base});
 let bodyMin=Infinity;
 for(const pose of fixture.result.drops[body].poses){rotation.fromArray(pose.rotation);
  for(const [id,source]of vertices.entries()){
   world.fromArray(source).applyQuaternion(rotation);world.x+=pose.position[0];world.y+=pose.position[1];world.z+=pose.position[2];const point=world.toArray() as [number,number,number];
   for(let k=0;k<3;k++)pointBytes.writeDoubleLE(point[k]!,k*8);pointHash.update(pointBytes);
   const result=tracker.sample(id,point),exact=referenceView.getFloat64(points*8,true);points++;
   if(result.kind==='known'){minimum=Math.min(minimum,result.lowerBound);bodyMin=Math.min(bodyMin,result.lowerBound);if(!Number.isFinite(exact)||result.lowerBound>exact+1e-12)violations++;}else unknowns++;
   if(points>500000||performance.now()-started>180000)throw Error('Tracked inspection budget exceeded');
  }
 }
 const stats=tracker.snapshot();oracleQueries+=stats.queries;propagated+=stats.propagated;bodies.push({body,minimumLowerBound:bodyMin,stats});
}}finally{geometry.dispose();}
const pointSequenceSha256=pointHash.digest('hex');if(pointSequenceSha256!==reference.reference.pointSequenceSha256||points!==reference.reference.count)throw Error('Trajectory point sequence changed');
for(const[path,h]of Object.entries(sources))if(sha(readFileSync(path))!==h)throw Error('Input changed');
const result={scope:'Actual static-distance cache on the exact retained proxy-vertex sequence; compared point-by-point to full-query reference. Positive bounds only; 1e-7 m padding. No between-sample/whole-material certification.',sources,buildMs,elapsedMs:performance.now()-started,queryMs,points,pointSequenceSha256,oracleQueries,propagated,unknowns,violations,minimumLowerBound:minimum,referenceMinimum:reference.minimum,bodies};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,sources:undefined},null,2));if(violations||unknowns)throw Error('Tracked clearance does not qualify');if(reference.minimum<0&&Math.abs(minimum-(reference.minimum-1e-7))>1e-12)throw Error('Minimum conservative bound changed unexpectedly');
