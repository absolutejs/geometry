import { closedComponents } from './closedComponents.js';
import { signedVolume } from './signedVolume.js';
import type { OverlapMesh, OverlapSolid } from './overlap.js';

export type MaterialPartitionKernel<S extends OverlapSolid> = {
  create(mesh: OverlapMesh): S;
  subtract(a: S, b: S): S;
  union(a: S, b: S): S;
  mesh(solid: S): OverlapMesh;
};

/**
 * Ordered CSG material ownership: cell i = input i minus all earlier inputs.
 * Input order is the host's explicit policy. The separate union mesh is the
 * exterior; cell boundaries include INTERNAL partition walls and must not be
 * blindly rendered or interpreted as fractures. No attachment/strength inference.
 *
 * The host must supply correct Boolean operations and fresh disposable handles.
 * Meshes are valid, consistently oriented, non-self-intersecting solid boundaries;
 * closedComponents checks topology, not geometric self-intersection. All input
 * geometry is copied/rebased before the host sees it. Returned meshes are copied.
 * Native work is bounded by input/output sizes and operation count, not wall time.
 * Run in a cancellable worker for a wall-clock deadline.
 */
export function partitionSolidMaterials<S extends OverlapSolid>(
  meshes: readonly OverlapMesh[],
  kernel: MaterialPartitionKernel<S>,
  maximumOperations = 126,
) {
  if (!Array.isArray(meshes) || !meshes.length || meshes.length > 64 ||
      !kernel || !['create','subtract','union','mesh'].every(k =>
        typeof kernel[k as keyof MaterialPartitionKernel<S>] === 'function') ||
      !Number.isSafeInteger(maximumOperations) || maximumOperations < 0 || maximumOperations > 126 ||
      2 * (meshes.length - 1) > maximumOperations ||
      meshes.reduce((n,m)=>n+(m?.positions?.length ?? Infinity),0) > 300000 ||
      meshes.reduce((n,m)=>n+(m?.indices?.length ?? Infinity),0) > 600000)
    throw Error('Invalid material partition budget');
  const inputs = meshes as readonly OverlapMesh[];
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  const volumes = inputs.map(m => {
    if (!(m.positions instanceof Float64Array) || !(m.indices instanceof Uint32Array) || !m.indices.length)
      throw Error('Invalid material partition mesh');
    closedComponents(m.positions,m.indices);
    const v = signedVolume(m.positions,m.indices);
    if (!Number.isFinite(v) || v <= 0) throw Error('Invalid material input volume');
    m.positions.forEach((p,i) => {min[i%3] = Math.min(min[i%3]!,p);max[i%3] = Math.max(max[i%3]!,p);});
    return v;
  });
  const origin = min.map((v,k)=>v/2+max[k]!/2);
  const handles = new Set<S>(), seen = new Set<S>();
  const own = (s:S) => {
    if (seen.has(s)) throw Error('Material kernel must return fresh handles');
    seen.add(s); handles.add(s); return s;
  };
  const release = (s:S) => { handles.delete(s); s.delete(); };
  let maximumVolumeError = 0, outputVertices = 0, outputIndices = 0, operations = 0;
  const checkVolume = (actual:number,expected:number) => {
    const error = Math.abs(actual / expected - 1);
    if (!Number.isFinite(error) || error > 1e-5) throw Error('Material volume precision budget exceeded');
    maximumVolumeError = Math.max(maximumVolumeError,error);
  };
  const read = (s:S) => {
    const volume = s.volume();
    if (!Number.isFinite(volume) || volume < 0) throw Error('Invalid partition output volume');
    const raw = kernel.mesh(s);
    if (!(raw?.positions instanceof Float64Array) || !(raw?.indices instanceof Uint32Array) ||
        (outputVertices += raw.positions.length / 3) > 200000 ||
        (outputIndices += raw.indices.length) > 1200000)
      throw Error('Material output budget exceeded');
    const positions = raw.positions.slice(), indices = raw.indices.slice();
    if (!indices.length) {
      if (positions.length || volume !== 0) throw Error('Invalid empty material cell');
      return {positions,indices,volume};
    }
    closedComponents(positions,indices);
    checkVolume(signedVolume(positions,indices),volume);
    for(let i=0;i<positions.length;i++) positions[i] = positions[i]! + origin[i%3]!;
    // Re-check precision after restoring the requested coordinate frame.
    checkVolume(signedVolume(positions,indices),volume);
    return {positions,indices,volume};
  };
  try {
    const cells:({source:number} & OverlapMesh & {volume:number})[] = [];
    let combined:S|undefined;
    for(let i=0;i<inputs.length;i++){
      const m=inputs[i]!;
      const input = own(kernel.create({
        positions:Float64Array.from(m.positions,(v,j)=>v-origin[j%3]!),
        indices:m.indices.slice(),
      }));
      checkVolume(input.volume(),volumes[i]!);
      const exclusive = combined ? own(kernel.subtract(input,combined)) : input;
      if(combined) operations++;
      if(exclusive.volume()>input.volume()*1.00001) throw Error('Partition subtraction enlarged material');
      cells.push({source:i,...read(exclusive)});
      if(combined){
        release(exclusive);
        const previous=combined;
        combined=own(kernel.union(previous,input));operations++;
        release(previous);release(input);
      } else combined=input;
    }
    const exterior=read(combined!);
    const materialVolume=cells.reduce((n,c)=>n+c.volume,0);
    checkVolume(materialVolume,exterior.volume);
    const authoredVolume=volumes.reduce((n,v)=>n+v,0);
    if(exterior.volume>authoredVolume*1.00001) throw Error('Partition union enlarged material');
    return {cells,exterior,inputVolumes:volumes,authoredVolume,
      materialVolume:exterior.volume,volumeDifference:authoredVolume-exterior.volume,
      maximumVolumeError,operations};
  } finally {
    for(const h of [...handles].reverse()) h.delete();
  }
}
export type SolidMaterialPartition = ReturnType<typeof partitionSolidMaterials>;
