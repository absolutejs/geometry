import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import { mergeIndexedMesh } from './mergeIndexedMesh.js';
import type { OverlapMesh } from './overlap.js';
import type { SurfaceOrigins } from './surfaceOrigins.js';

/** Optional adapter: caller supplies its initialized Manifold 3.5.1 module.
 * Explicit source IDs are for partitioning; omitted IDs are fresh for overlap
 * audit operands. No engine is imported at runtime. Use a new adapter per job.
 * Rebase each exported solid independently BEFORE the native Float32 export,
 * then restore its origin in double precision. No simplification or welding. */
export function createManifoldPartitionKernel(wasm: ManifoldToplevel, sourceCount=64) {
  if(!Number.isSafeInteger(sourceCount) || sourceCount<1 || sourceCount>64)
    throw Error('Invalid Manifold source budget');
  const base=wasm.Manifold.reserveIDs(sourceCount);
  const checked=(s:Manifold)=>{
    if(s.status()!=='NoError'){s.delete();throw Error('Invalid Manifold material operation');}
    return s;
  };
  return {
    create(mesh:OverlapMesh,source?:number) {
      if(source!==undefined && (!Number.isInteger(source) || source<0 || source>=sourceCount))
        throw Error('Invalid Manifold source ID');
      return checked(new wasm.Manifold(new wasm.Mesh({
        numProp:3,vertProperties:Float32Array.from(mesh.positions),triVerts:mesh.indices,
        faceID:Uint32Array.from({length:mesh.indices.length/3},(_,i)=>i),
        runOriginalID:new Uint32Array([source===undefined?wasm.Manifold.reserveIDs(1):base+source]),
        runIndex:new Uint32Array([0,mesh.indices.length]),
      })));
    },
    subtract:(a:Manifold,b:Manifold)=>checked(a.subtract(b)),
    union:(a:Manifold,b:Manifold)=>checked(a.add(b)),
    intersect:(a:Manifold,b:Manifold)=>checked(a.intersect(b)),
    mesh(solid:Manifold) {
      if(solid.isEmpty()) return {
        positions:new Float64Array(),indices:new Uint32Array(),
        origins:{sources:new Uint16Array(),faces:new Uint32Array(),reversed:new Uint8Array()} as SurfaceOrigins,
      };
      const bounds=solid.boundingBox(),
        center=bounds.min.map((v,i)=>v/2+bounds.max[i]!/2) as [number,number,number],
        local=checked(solid.translate(center.map(v=>-v) as [number,number,number]));
      try {
        const mesh=local.getMesh(),closed=mergeIndexedMesh(mesh,center,local.tolerance()),
          count=closed.indices.length/3;
        if(mesh.faceID.length!==count || mesh.runIndex.length!==mesh.runOriginalID.length+1 ||
          mesh.runIndex[0]!==0 || mesh.runIndex[mesh.runIndex.length-1]!==closed.indices.length)
          throw Error('Invalid Manifold face ancestry');
        const origins:SurfaceOrigins={sources:new Uint16Array(count).fill(65535),
          faces:mesh.faceID.slice(),reversed:new Uint8Array(count)};
        for(let run=0;run<mesh.runOriginalID.length;run++){
          const source=mesh.runOriginalID[run]!-base,start=mesh.runIndex[run]!,end=mesh.runIndex[run+1]!;
          if(source<0 || source>=sourceCount || start%3 || end%3 || end<start || end>closed.indices.length)
            throw Error('Unknown Manifold face ancestry');
          for(let t=start/3;t<end/3;t++){
            origins.sources[t]=source;origins.reversed[t]=mesh.backside(run)?1:0;
          }
        }
        return {...closed,origins};
      } finally {local.delete();}
    },
  };
}
