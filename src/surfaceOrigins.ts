import type { OverlapMesh } from './overlap.js';
import { triangleWeights } from './triangleWeights.js';

/** Face ancestry describes boundary origin, not the volume owner of a cell.
 * reversed=1 marks the backside of a source face introduced by subtraction. */
export type SurfaceOrigins = {
  sources: Uint16Array;
  faces: Uint32Array;
  reversed: Uint8Array;
};
export function auditSurfaceOrigins(
  mesh: OverlapMesh,
  origins: SurfaceOrigins,
  sources: readonly OverlapMesh[],
  maximumPlaneDistance = 1e-6,
) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 64 ||
      !Number.isFinite(maximumPlaneDistance) || maximumPlaneDistance < 1e-7 || maximumPlaneDistance > 1e-5 ||
      sources.reduce((n,s)=>n+(s?.positions?.length ?? Infinity),0)>300000 ||
      sources.reduce((n,s)=>n+(s?.indices?.length ?? Infinity),0)>600000)
    throw Error('Invalid surface origin budget');
  const validate=(m:OverlapMesh,maximumPositions:number,maximumIndices:number)=>{
    if(!(m?.positions instanceof Float64Array) || !(m?.indices instanceof Uint32Array) ||
       m.positions.length>maximumPositions || m.indices.length>maximumIndices ||
       m.positions.length%3 || m.indices.length%3 ||
       !m.positions.every(Number.isFinite) ||
       !m.indices.every(i=>i<m.positions.length/3)) throw Error('Invalid surface origin mesh');
  };
  validate(mesh,600000,1200000);
  for(const s of sources as readonly OverlapMesh[]) validate(s,300000,600000);
  const count=mesh.indices.length/3;
  if(!origins || !(origins.sources instanceof Uint16Array) ||
     !(origins.faces instanceof Uint32Array) || !(origins.reversed instanceof Uint8Array) ||
     [origins.sources,origins.faces,origins.reversed].some(a=>a.length!==count))
    throw Error('Invalid surface origin arrays');
  const point=(m:OverlapMesh,index:number):[number,number,number]=>{
    const i=m.indices[index]!*3;
    return [m.positions[i]!,m.positions[i+1]!,m.positions[i+2]!];
  };
  const normal=(p:[number,number,number][])=>{
    const u=p[1]!.map((v,i)=>v-p[0]![i]!),v=p[2]!.map((v,i)=>v-p[0]![i]!);
    return [u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!];
  };
  let reversedFaces=0;
  for(let t=0;t<count;t++){
    const source=(sources as readonly OverlapMesh[])[origins.sources[t]!],face=origins.faces[t]!,reverse=origins.reversed[t]!;
    if(!source || face>=source.indices.length/3 || reverse>1) throw Error('Surface origin out of range');
    const original=[0,1,2].map(k=>point(source,face*3+k)),output=[0,1,2].map(k=>point(mesh,t*3+k));
    for(const p of output) triangleWeights(p,original[0]!,original[1]!,original[2]!,maximumPlaneDistance);
    const a=normal(original),b=normal(output),dot=a.reduce((n,v,i)=>n+v*b[i]!,0);
    if(!Number.isFinite(dot) || (reverse ? dot>=0 : dot<=0)) throw Error('Surface origin winding mismatch: '+JSON.stringify({face:t,source:origins.sources[t],originalFace:face,reversed:reverse,dot,original,output}));
    reversedFaces+=reverse;
  }
  return {faces:count,reversedFaces,maximumPlaneDistance};
}
