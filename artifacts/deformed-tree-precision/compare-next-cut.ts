import Module from 'manifold-3d';
import {readFileSync,writeFileSync}from'node:fs';
import{createManifoldMesh64 as candidate}from'../../src/manifold';
import{createManifoldMesh64 as published}from'/home/alexkahn/alex/hello-world/node_modules/@absolutejs/geometry/dist/manifold.js';
const w=await Module();w.setup();const d=JSON.parse(readFileSync('artifacts/deformed-tree-precision/roundtrip-next-cut.json','utf8')),t=d.tool,[x,y,z]=t.halfExtents;
const seed=w.Manifold.hull([-z,z].flatMap(z=>[[-x,-y,z],[-x,y,z],[x,0,z]])),cutter=seed.transform([...t.axes[0],0,...t.axes[1],0,...t.axes[2],0,...t.center,1]);
const rows=[];
try{for(const[name,create]of[['published016',published],['candidate',candidate]]as const){const s=create(w,{numProp:3,vertProperties:Float64Array.from(d.positions),triVerts:Uint32Array.from(d.indices)});const[r,k]=s.split(cutter);try{rows.push({name,inputVolume:s.volume(),removedVolume:r.volume(),removedReference:d.removedVolume,removedRelativeError:Math.abs(r.volume()/d.removedVolume-1),retainedVolume:k.volume(),retainedReference:d.retainedVolume,retainedRelativeError:Math.abs(k.volume()/d.retainedVolume-1)});}finally{k.delete();r.delete();s.delete();}}}finally{cutter.delete();seed.delete();}
writeFileSync('docs/zero-extent-qualification-2026-10-31/default-face-next-cut-comparison.json',JSON.stringify(rows,null,2));console.log(rows);
