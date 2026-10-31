import Module from 'manifold-3d';
import {readFileSync,writeFileSync} from 'node:fs';
import {createManifoldPartitionKernel} from '../../src/manifold';
import {auditSurfaceOrigins} from '../../src/surfaceOrigins';
import {closedComponents} from '../../src/closedComponents';
const wasm=await Module();wasm.setup();const rows=[];
for(const variant of [2,3]) {
 const source=JSON.parse(readFileSync(`artifacts/import-precision/variant-${variant}.json`,'utf8'));
 const inputs=source.inputs.map((m:any)=>({positions:Float64Array.from(m.positions),indices:Uint32Array.from(m.indices)}));
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const m of inputs)m.positions.forEach((v:number,i:number)=>{min[i%3]=Math.min(min[i%3]!,v);max[i%3]=Math.max(max[i%3]!,v);});const origin=min.map((v,k)=>(v+max[k]!)/2);
 const kernel=createManifoldPartitionKernel(wasm,inputs.length);let combined;
 try{
  for(let i=0;i<inputs.length;i++){const m=inputs[i]!,input=kernel.create({positions:Float64Array.from(m.positions,(v,j)=>v-origin[j%3]!),indices:m.indices},i);if(!combined)combined=input;else{try{const next=kernel.union(combined,input);combined.delete();combined=next;}finally{input.delete();}}}
  const mesh=kernel.mesh(combined!);for(let i=0;i<mesh.positions.length;i++)mesh.positions[i]+=origin[i%3]!;
  closedComponents(mesh.positions,mesh.indices);const ancestry=auditSurfaceOrigins(mesh,mesh.origins,inputs);rows.push({variant,accepted:true,ancestry,volume:combined!.volume()});
 }catch(error){rows.push({variant,accepted:false,error:String(error)});}finally{combined?.delete();}
}
writeFileSync('artifacts/import-precision/union-result.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));
