import {closedComponents} from './closedComponents.js';
import {signedVolume} from './signedVolume.js';
import {triangleWeights} from './triangleWeights.js';
type V=readonly [number,number,number];
type Result={kind:'known';classification:'inside'|'outside'|'boundary';signedDistance:number;triangle:number}|{kind:'unknown';reason:'synthetic-boundary'|'unresolved-witness'|'ambiguous-sign';triangle:number};
const sub=(a:V,b:V):[number,number,number]=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:V,b:V):[number,number,number]=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=(a:V):[number,number,number]=>{const length=Math.hypot(...a);if(!Number.isFinite(length)||length===0)throw Error('Degenerate witness normal');return a.map(x=>x/length) as [number,number,number];};
/** Research classifier for an externally computed *nearest* triangle witness.
 * Requires an outward, non-self-intersecting closed boundary; topology and
 * positive volume are checked, arbitrary self-intersection is not certified.
 * Uses angle-weighted vertex and adjacent-face edge pseudonormals. Caller must
 * retain exact triangle identity. Ambiguous/synthetic features remain unknown. */
export function classifyMeshWitness(source:Float64Array,faces:Uint32Array,materialTriangles=faces.length/3){
 closedComponents(source,faces);
 if(!faces.length||!Number.isSafeInteger(materialTriangles)||materialTriangles<0||materialTriangles>faces.length/3)throw Error('Invalid material triangle range');
 const positions=source.slice(),indices=faces.slice();
 const volume=signedVolume(positions,indices);
 if(!Number.isFinite(volume)||volume<=0)throw Error('Witness boundary must have finite positive orientation');
 const point=(id:number):[number,number,number]=>[positions[id*3]!,positions[id*3+1]!,positions[id*3+2]!];
 const normals:V[]=[],vertices=Array.from({length:positions.length/3},()=>[0,0,0] as [number,number,number]),vertexSynthetic=new Uint8Array(vertices.length);
 const edges=new Map<string,{normal:[number,number,number];synthetic:boolean}>();
 const key=(a:number,b:number)=>Math.min(a,b)+':'+Math.max(a,b);
 for(let t=0;t<indices.length/3;t++){
  const ids=[indices[t*3]!,indices[t*3+1]!,indices[t*3+2]!],p=ids.map(point),n=unit(cross(unit(sub(p[1]!,p[0]!)),unit(sub(p[2]!,p[0]!))));normals.push(n);
  for(let j=0;j<3;j++){
   const a=ids[j]!,b=ids[(j+1)%3]!,e=edges.get(key(a,b))??{normal:[0,0,0] as [number,number,number],synthetic:false};
   for(let k=0;k<3;k++)e.normal[k]!+=n[k]!;e.synthetic ||= t>=materialTriangles;edges.set(key(a,b),e);
   const x=unit(sub(p[(j+1)%3]!,p[j]!)),y=unit(sub(p[(j+2)%3]!,p[j]!)),angle=Math.atan2(Math.hypot(...cross(x,y)),dot(x,y));
   for(let k=0;k<3;k++)vertices[a]![k]!+=n[k]!*angle;if(t>=materialTriangles)vertexSynthetic[a]=1;
  }
 }
 return (query:V,witness:{point:V;triangle:number}):Result=>{
  if(!Array.isArray(query)||query.length!==3||!query.every(Number.isFinite)||!witness||!Array.isArray(witness.point)||witness.point.length!==3||!witness.point.every(Number.isFinite)||!Number.isSafeInteger(witness.triangle)||witness.triangle<0||witness.triangle>=normals.length)throw Error('Invalid nearest witness');
  const triangle=witness.triangle,ids=[indices[triangle*3]!,indices[triangle*3+1]!,indices[triangle*3+2]!];
  let weights:[number,number,number];try{weights=triangleWeights(witness.point,point(ids[0]!),point(ids[1]!),point(ids[2]!));}catch{return{kind:'unknown',reason:'unresolved-witness',triangle};}
  const candidates:{normal:V;synthetic:boolean}[]=[{normal:normals[triangle]!,synthetic:triangle>=materialTriangles}];
  const near=weights.map((w,i)=>w<=1e-10?i:-1).filter(i=>i>=0);
  for(const j of near)candidates.push(edges.get(key(ids[(j+1)%3]!,ids[(j+2)%3]!))!);
  if(near.length>=2){const id=ids[weights.indexOf(Math.max(...weights))]!;candidates.push({normal:vertices[id]!,synthetic:!!vertexSynthetic[id]});}
  if(candidates.some(c=>c.synthetic))return{kind:'unknown',reason:'synthetic-boundary',triangle};
  const delta=sub(query,witness.point),distance=Math.hypot(...delta);if(!Number.isFinite(distance))throw Error('Invalid witness distance');
  if(distance<=1e-7)return{kind:'known',classification:'boundary',signedDistance:0,triangle};
  // Near a feature, require agreement between plausible face/edge/vertex signs
  // rather than silently snapping a slightly interior witness onto an edge.
  const signs=candidates.map(c=>{const length=Math.hypot(...c.normal);if(!length)return 0;const d=dot(delta,c.normal)/length;return Math.abs(d)<=distance*1e-12?0:Math.sign(d);});
  if(signs.some(s=>s===0||s!==signs[0]))return{kind:'unknown',reason:'ambiguous-sign',triangle};
  return{kind:'known',classification:signs[0]!<0?'inside':'outside',signedDistance:signs[0]!*distance,triangle};
 };
}
