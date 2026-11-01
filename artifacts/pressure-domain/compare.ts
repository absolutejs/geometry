import { prepareTrianglePositiveQuadraticMoments as optimized } from '../../dist/trianglePositiveQuadraticMoments.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const baselinePath='/home/alexkahn/alex/geometry-linear-domain/dist/trianglePositiveQuadraticMoments.js';
const {prepareTrianglePositiveQuadraticMoments:baseline}=await import(baselinePath);
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const paths=[baselinePath,'/home/alexkahn/alex/geometry-linear-domain/dist/positiveTriangleMoments.js','dist/trianglePositiveQuadraticMoments.js','dist/positiveTriangleMoments.js','artifacts/pressure-domain/compare.ts'];
const before=paths.map(hash);
let seed=0x751ca32b;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
let cases=0,full=0,baselineMs=0,optimizedMs=0;
const fields=['area','fullArea','integral','cubicIntegral','relativeFirstMoment','meanOffset','reference','surfaceNormal'];
for(let t=0;t<10000;t++){
 const scale=10**(-40+80*random()), k=10**(-50+100*random());
 const triangle=Array.from({length:3},()=>[random()*scale,random()*scale,random()*scale] as [number,number,number]);
 const a=baseline(triangle),b=optimized(triangle);
 const signed=()=>[random()*2-1,random()*2-1,random()*2-1];
 const positive=()=>[random(),random(),random()];
 const queries=[
  {v:positive(),d:undefined},{v:positive(),d:positive()},
  {v:[0,random(),0],d:[0,1,0]},{v:signed(),d:positive()},
  {v:positive(),d:signed()},{v:signed(),d:signed()},
  {v:positive(),d:[0,0,0]},{v:[0,0,0],d:positive()},
  {v:[-1,-2,-3],d:undefined},{v:signed(),d:undefined}
 ];
 for(const q of queries){
  const v=q.v.map(x=>x*k);let expected:any,actual:any,start:number;
  if(cases%2===0){start=performance.now();expected=a(v,q.d);baselineMs+=performance.now()-start;start=performance.now();actual=b(v,q.d);optimizedMs+=performance.now()-start;}
  else {start=performance.now();actual=b(v,q.d);optimizedMs+=performance.now()-start;start=performance.now();expected=a(v,q.d);baselineMs+=performance.now()-start;}
  for(const key of fields){
   const x=expected[key],y=actual[key];
   if(Array.isArray(x)){if(!Array.isArray(y)||x.length!==y.length||x.some((n,i)=>n!==y[i]))throw Error(`Changed ${key} at triangle ${t}, case ${cases}`);}
   else if(x!==y)throw Error(`Changed ${key} at triangle ${t}, case ${cases}`);
  }
  cases++;if(actual.area===actual.fullArea)full++;
 }
}
const after=paths.map(hash);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Source changed');
const result={cases,full,exactlyEqual:true,baselineMs,optimizedMs,ratio:optimizedMs/baselineMs,sourceUnchanged:true,hashes:Object.fromEntries(paths.map((p,i)=>[p,before[i]])),scope:'Deterministic affine field comparison with alternating timed order; not game FPS'};
writeFileSync('docs/affine-scalar-2026-11-01/quadratic-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
