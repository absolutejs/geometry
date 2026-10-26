import Module from 'manifold-3d';
import {writeFileSync} from 'node:fs';
const wasm=await Module();wasm.setup();
const cube=wasm.Manifold.cube([1e-6,2e-6,3e-6],true),moved=cube.translate([3,2,1]);
const exact:number[][]=[];
const tagged=moved.setProperties(1,(props,position)=>{props[0]=exact.length;exact.push([...position]);});
try{
 const mesh=tagged.getMesh(),rows=[];
 for(let i=0;i<mesh.numVert;i++)rows.push({id:mesh.vertProperties[i*4+3]!,raw:Array.from(mesh.vertProperties.slice(i*4,i*4+3)),exact:exact[mesh.vertProperties[i*4+3]!]});
 const result={bounds:moved.boundingBox(),volume:moved.volume(),taggedVolume:tagged.volume(),numProp:mesh.numProp,numVert:mesh.numVert,callbacks:exact.length,faceIDs:Array.from(mesh.faceID),originalIDs:Array.from(mesh.runOriginalID),rows};
 writeFileSync('docs/precision-export-2026-10-26/probe.json',JSON.stringify(result,null,2));console.log(result);
}finally{tagged.delete();moved.delete();cube.delete();}
