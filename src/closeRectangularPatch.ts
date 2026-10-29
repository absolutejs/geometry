import { closedComponents } from './closedComponents.js';
import { signedVolume } from './signedVolume.js';
/** Research primitive: close one consistently indexed rectangular patch below an
 * axis-aligned plane. Never weld coordinates or modify source faces. Synthetic
 * faces are inspection boundaries, not authored/collision material. This checks
 * topology, not arbitrary source self-intersection. Unsupported inputs throw. */
export function closeRectangularPatch(
 positions: Float64Array, indices: Uint32Array, axis: 0 | 1 | 2, base: number,
) {
 if (!(positions instanceof Float64Array) || positions.length < 9 || positions.length % 3 || positions.length > 270000 ||
     !positions.every(x => Number.isFinite(x) && Math.abs(x) <= 1e9) ||
     !(indices instanceof Uint32Array) || !indices.length || indices.length % 3 || indices.length > 570000 ||
     !indices.every(i => i < positions.length / 3) || ![0,1,2].includes(axis) || !Number.isFinite(base) || Math.abs(base) > 1e9)
  throw Error('Invalid rectangular patch');
 const u=(axis+1)%3,v=(axis+2)%3;
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){low[k]=Math.min(low[k]!,positions[i+k]!);high[k]=Math.max(high[k]!,positions[i+k]!);}
 if(!(base<low[axis]!) || !(high[u]!>low[u]!) || !(high[v]!>low[v]!))throw Error('Invalid closure plane or footprint');
 const edges=new Map<string,{a:number;b:number;count:number}>();
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]!,b=indices[i+1]!,c=indices[i+2]!;
  if(a===b||a===c||b===c)throw Error('Degenerate patch face');
  const x=[0,1,2].map(k=>positions[b*3+k]!-positions[a*3+k]!),y=[0,1,2].map(k=>positions[c*3+k]!-positions[a*3+k]!);
  const scale=Math.max(...x.map(Math.abs),...y.map(Math.abs));
  const p=x.map(t=>t/scale),q=y.map(t=>t/scale);
  if(!scale||!Math.hypot(p[1]!*q[2]!-p[2]!*q[1]!,p[2]!*q[0]!-p[0]!*q[2]!,p[0]!*q[1]!-p[1]!*q[0]!))throw Error('Collinear patch face');
  for(let k=0;k<3;k++){
   const a=indices[i+k]!,b=indices[i+(k+1)%3]!,key=Math.min(a,b)+':'+Math.max(a,b),e=edges.get(key);
   if(e){if(e.count!==1||e.a!==b||e.b!==a)throw Error('Inconsistent or nonmanifold patch');e.count++;}
   else edges.set(key,{a,b,count:1});
  }
 }
 const boundary=[...edges.values()].filter(e=>e.count===1);
 if(boundary.length<4||boundary.length>4096||positions.length+3*(boundary.length+1)>300000||indices.length+9*boundary.length>600000)throw Error('Patch boundary budget exceeded');
 const next=new Map<number,number>(),incoming=new Set<number>();
 for(const e of boundary){if(next.has(e.a)||incoming.has(e.b))throw Error('Branching patch boundary');next.set(e.a,e.b);incoming.add(e.b);}
 const loop:number[]=[],seen=new Set<number>();let current=boundary[0]!.a;
 while(!seen.has(current)){seen.add(current);loop.push(current);const n=next.get(current);if(n===undefined)throw Error('Broken patch boundary');current=n;}
 if(current!==loop[0]||loop.length!==boundary.length)throw Error('Patch must have exactly one boundary loop');
 const parameter=(i:number)=>{
  const x=positions[i*3+u]!,y=positions[i*3+v]!,a=(x-low[u]!)/(high[u]!-low[u]!),b=(y-low[v]!)/(high[v]!-low[v]!);
  if(y===low[v])return a;
  if(x===high[u])return 1+b;
  if(y===high[v])return 3-a;
  if(x===low[u])return 4-b;
  throw Error('Boundary is not on rectangular footprint');
 };
 let wraps=0;const footprint=new Set<string>();
 for(let i=0;i<loop.length;i++){
  const a=loop[i]!,b=loop[(i+1)%loop.length]!,key=positions[a*3+u]+','+positions[a*3+v];
  if(footprint.has(key))throw Error('Boundary projection overlaps');footprint.add(key);
  if(![u,v].some(k=>[low[k],high[k]].some(value=>positions[a*3+k]===value&&positions[b*3+k]===value)))throw Error('Boundary skips a rectangle corner');
  const ta=parameter(a),tb=parameter(b);if(ta===tb)throw Error('Unresolved boundary projection');if(tb<ta)wraps++;
 }
 if(wraps!==1)throw Error('Boundary must traverse rectangle once with positive axis orientation');
 const output=new Float64Array(positions.length+3*(loop.length+1));output.set(positions);
 const lower=new Map<number,number>();
 loop.forEach((id,k)=>{const at=positions.length/3+k;lower.set(id,at);for(let c=0;c<3;c++)output[at*3+c]=c===axis?base:positions[id*3+c]!;});
 const center=output.length/3-1;
 for(let k=0;k<3;k++)output[center*3+k]=k===axis?base:low[k]!+(high[k]!-low[k]!)/2;
 const faces=new Uint32Array(indices.length+loop.length*9);faces.set(indices);
 loop.forEach((a,i)=>{const b=loop[(i+1)%loop.length]!,la=lower.get(a)!,lb=lower.get(b)!;faces.set([b,a,la,b,la,lb,center,lb,la],indices.length+i*9);});
 if(closedComponents(output,faces).length!==1)throw Error('Patch contains disconnected components');
 const volume=signedVolume(output,faces);if(!Number.isFinite(volume)||volume<=0)throw Error('Invalid closure volume');
 return {positions:output,indices:faces,sourceTriangleCount:indices.length/3,syntheticTriangleCount:loop.length*3,boundary:Uint32Array.from(loop),axis,base,volume};
}
