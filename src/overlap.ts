import { closedComponents } from './closedComponents.js';
import { signedVolume } from './signedVolume.js';
export type OverlapMesh = { positions: Float64Array; indices: Uint32Array };
/** The host injects its Boolean kernel; all returned handles must be disposable. */
export type OverlapSolid = {
  volume(): number;
  delete(): void;
};
export type SolidOverlapAudit = ReturnType<typeof auditSolidOverlaps>;
/** Audit initial material overlap, not dynamic contact depth. Inputs must be valid
 * oriented solid boundaries in one frame. No ownership, de-duplication or repair
 * is inferred. Bounds skip disjoint/touching pairs; candidate pairs are rebased
 * before invoking the host's kernel. Every native handle is released. */
export function auditSolidOverlaps<S extends OverlapSolid>(
  meshes: readonly OverlapMesh[],
  kernel: { create(mesh: OverlapMesh): S; intersect(a: S, b: S): S },
  maximumQueries = 256,
) {
  if (!Array.isArray(meshes) || meshes.length > 64 || !kernel || typeof kernel.create !== 'function' || typeof kernel.intersect !== 'function' ||
      !Number.isSafeInteger(maximumQueries) || maximumQueries < 1 || maximumQueries > 1024 ||
      meshes.reduce((n,m)=>n+(m?.positions?.length ?? Infinity),0)>300000 ||
      meshes.reduce((n,m)=>n+(m?.indices?.length ?? Infinity),0)>600000)
    throw Error('Invalid overlap audit budget');
  const records=(meshes as readonly OverlapMesh[]).map(mesh=>{
    if (!mesh.indices.length) throw Error('Empty overlap solid');
    closedComponents(mesh.positions,mesh.indices);
    const volume=signedVolume(mesh.positions,mesh.indices);
    if (!(volume>0) || !Number.isFinite(volume)) throw Error('Invalid overlap solid volume');
    const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
    mesh.positions.forEach((v,i)=>{min[i%3]=Math.min(min[i%3]!,v);max[i%3]=Math.max(max[i%3]!,v);});
    return {...mesh,volume,min,max};
  });
  const pairs:{a:number;b:number;volume:number;fractionOfSmaller:number}[]=[];
  let queries=0,boundsSkipped=0,maximumInputVolumeError=0;
  for(let a=0;a<records.length;a++)for(let b=a+1;b<records.length;b++){
    const one=records[a]!,two=records[b]!;
    if(one.min.some((v,k)=>v>=two.max[k]! || one.max[k]!<=two.min[k]!)){boundsSkipped++;continue;}
    if(++queries>maximumQueries)throw Error('Overlap query budget exceeded');
    const origin=one.min.map((v,k)=>(Math.min(v,two.min[k]!)+Math.max(one.max[k]!,two.max[k]!))/2);
    const handles:S[]=[];
    try {
      const solids=[one,two].map(record=>{
        const local=Float64Array.from(record.positions,(v,i)=>v-origin[i%3]!);
        const solid=kernel.create({positions:local,indices:record.indices.slice()});handles.push(solid);
        const error=Math.abs(solid.volume()/record.volume-1);
        if(!Number.isFinite(error)||error>1e-5)throw Error('Overlap input precision budget exceeded');
        maximumInputVolumeError=Math.max(maximumInputVolumeError,error);
        return solid;
      });
      const intersection=kernel.intersect(solids[0]!,solids[1]!);handles.push(intersection);
      const volume=intersection.volume(),fractionOfSmaller=volume/Math.min(one.volume,two.volume);
      if(!Number.isFinite(volume)||volume<0||fractionOfSmaller>1.00001)throw Error('Invalid overlap volume');
      pairs.push({a,b,volume,fractionOfSmaller});
    }finally{for(const handle of handles.reverse())handle.delete();}
  }
  return {meshes:records.length,volumes:records.map(r=>r.volume),pairs,queries,boundsSkipped,maximumInputVolumeError};
}
