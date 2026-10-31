import Module from 'manifold-3d';
import { readFileSync,writeFileSync } from 'node:fs';
import { partitionSolidMaterials } from '../../src/materialPartition';
import { createManifoldPartitionKernel } from '../../src/manifold';
const wasm=await Module();wasm.setup();const rows=[];
for(const variant of [2,3])for(const restore of [false,true]) {
 const source=JSON.parse(readFileSync(`artifacts/import-precision/variant-${variant}.json`,'utf8'));
 const inputs=source.inputs.map((m:any)=>({positions:Float64Array.from(m.positions),indices:Uint32Array.from(m.indices)}));
 const kernel=createManifoldPartitionKernel(wasm,inputs.length),base=kernel.create;
 if(restore)kernel.create=(mesh,owner)=>{
  const lookup=new Map<string,number[]>();
  for(let i=0;i<mesh.positions.length;i+=3){const p=Array.from(mesh.positions.slice(i,i+3)),key=p.map(Math.fround).join(',');const old=lookup.get(key);if(old&&old.some((v,k)=>v!==p[k]))throw Error('Collapsed input vertices');lookup.set(key,p);}
  const input=base(mesh,owner);
  try{return input.warp(p=>{const exact=lookup.get(p.join(','));if(!exact)throw Error('Unknown imported vertex');for(let k=0;k<3;k++)p[k]=exact[k]!;});}finally{input.delete();}
 };
 try{const r=partitionSolidMaterials(inputs,kernel);rows.push({variant,restore,accepted:true,volume:r.materialVolume,triangles:r.exterior.indices.length/3});}catch(error){rows.push({variant,restore,accepted:false,error:String(error)});}
}
writeFileSync('artifacts/import-precision/result.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
