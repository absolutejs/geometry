import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {prepareTriangleWeights,triangleWeights} from '../../dist/index.js';
const root=process.env.BASELINE_GEOMETRY_ROOT;if(!root)throw Error('Explicit frozen baseline required');
const baseline=await import(join(root,'index.js'));
const digest=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const inputs=[join(root,'triangleWeights.js'),join(root,'index.js'),'dist/triangleWeights.js','dist/index.js'];
const before=Object.fromEntries(inputs.map(p=>[p,digest(p)]));
type P=[number,number,number];let seed=81926341;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const fixtures=[];
for(let id=0;id<1000;id++){
 const scale=10**((id%7)-3),a=[0,1,2].map(()=>20000*(random()-.5)) as P,b=a.map(x=>x+(random()-.5)*scale) as P,c=a.map(x=>x+(random()-.5)*scale) as P;
 const query=prepareTriangleWeights(a,b,c),points:P[]=[];
 for(let k=0;k<100;k++){
  let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
  const p=a.map((x,j)=>x*(1-u-v)+b[j]!*u+c[j]!*v) as P;
  const reference=baseline.triangleWeights(p,a,b,c),prepared=query(p),single=triangleWeights(p,a,b,c);
  if(!reference.every((x:number,j:number)=>Object.is(x,prepared[j])&&Object.is(x,single[j])))throw Error('Interpolation changed '+JSON.stringify({id,k,reference,prepared,single}));
  points.push(p);
 }
 fixtures.push({a,b,c,query,points});
}
const samples=[];
for(let pass=0;pass<5;pass++)for(const mode of pass%2?['prepared','single','baseline']:['baseline','single','prepared']){
 const start=performance.now();let checksum=0;
 for(const f of fixtures)for(const p of f.points){const w=mode==='baseline'?baseline.triangleWeights(p,f.a,f.b,f.c):mode==='single'?triangleWeights(p,f.a,f.b,f.c):f.query(p);checksum+=w[0]+2*w[1]+3*w[2];}
 samples.push({pass,mode,elapsedMs:performance.now()-start,checksum});
}
if(!samples.every(s=>s.checksum===samples[0]!.checksum))throw Error('Timed query checksum changed');
const after=Object.fromEntries(inputs.map(p=>[p,digest(p)]));if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Loaded artifacts changed');
const output='research/prepared-weights-2026-11-01';mkdirSync(output,{recursive:true});writeFileSync(output+'/comparison.json',JSON.stringify({queries:100000,exact:true,before,after,unchanged:true,samples,runtime:'Bun CPU; warm paired observations, not browser FPS'},null,2)+'\n');
console.log(JSON.stringify({queries:100000,exact:true,samples}));
