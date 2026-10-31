import Module from 'manifold-3d';
import {readFileSync,writeFileSync} from 'node:fs';
import {closeConvexTube} from '../../src/closeConvexTube';
import {partitionSolidMaterials} from '../../src/materialPartition';
import {createManifoldPartitionKernel} from '../../src/manifold';
import {signedVolume} from '../../src/signedVolume';
const wasm=await Module();wasm.setup();const rows=[];
for(const variant of [2,3]){
 const source=JSON.parse(readFileSync(`artifacts/import-precision/variant-${variant}.json`,'utf8'));
 let maximumVolumeChange=0;
 const inputs=source.inputs.map((m:any)=>{
  // These captured capTube fixtures append exactly two generated cap centers.
  const count=m.positions.length/3-2;
  const sides=Array.from({length:m.indices.length/3},(_,t)=>m.indices.slice(t*3,t*3+3) as number[]).filter(f=>f.every(i=>i<count));
  const r=closeConvexTube(m.positions.slice(0,count*3),sides.flat());
  maximumVolumeChange=Math.max(maximumVolumeChange,Math.abs(signedVolume(r.positions,r.indices)/signedVolume(Float64Array.from(m.positions),Uint32Array.from(m.indices))-1));
  return r;
 });
 try {const r=partitionSolidMaterials(inputs,createManifoldPartitionKernel(wasm,inputs.length));rows.push({variant,accepted:true,maximumVolumeChange,volume:r.materialVolume,triangles:r.exterior.indices.length/3});}catch(error){rows.push({variant,accepted:false,error:String(error)});}
}
writeFileSync('artifacts/import-precision/cap-result.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
