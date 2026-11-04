import {test,expect} from 'bun:test';
import {prepareScalarContour2D} from '../src/scalarContour2D';
const grid=(n:number,spacing:number,f:(x:number,y:number)=>number)=>({width:n,height:n,spacing,values:Float64Array.from({length:n*n},(_,i)=>f((i%n)*spacing,Math.floor(i/n)*spacing))});
const brute=(s:Float64Array,x:number,y:number,r:number)=>{
 let best=r*r,id=-1,px=0,py=0;
 for(let i=0;i<s.length;i+=4){
  const a=s[i]!,b=s[i+1]!,u=s[i+2]!-a,v=s[i+3]!-b;
  const t=u*u+v*v?Math.max(0,Math.min(1,((x-a)*u+(y-b)*v)/(u*u+v*v))):0;
  const qx=a+t*u,qy=b+t*v,d=(x-qx)**2+(y-qy)**2;
  if(d<best||(d===best&&(id<0||i/4<id))){best=d;id=i/4;px=qx;py=qy;}
 }
 return id<0?null:{distance:Math.sqrt(best),segment:id,x:px,y:py};
};
test('subcell straight shore gives metric distance, finite radius and explicit missing domain',()=>{
 const c=prepareScalarContour2D(grid(17,.5,(x)=>x-3.17));
 for(const x of [0,1.1,3.17,5,8])for(const y of [0,.13,4,8]){
  expect(c.nearest(x,y,9)?.distance).toBeCloseTo(Math.abs(x-3.17),12);
  expect(c.nearest(x,y,9)?.x).toBeCloseTo(3.17,12);
 }
 expect(c.nearest(0,4,3)).toBeNull();expect(()=>c.nearest(-.01,4,9)).toThrow();
 expect(()=>c.nearest(1,1,Infinity)).toThrow();
});
test('curved contours converge to circle and hierarchy matches independent exhaustive segment queries',()=>{
 const errors=[];
 for(const spacing of [1,.5,.25]){
  const c=prepareScalarContour2D(grid(16/spacing+1,spacing,(x,y)=>Math.hypot(x-8,y-8)-4.31)),s=c.segments();
  let maxError=0;
  for(let i=0;i<240;i++){
   const x=((i*73)%1599)/100,y=((i*137)%1599)/100,r=1+(i%8);
   expect(c.nearest(x,y,r)).toEqual(brute(s,x,y,r));
   const hit=c.nearest(x,y,30)!;
   maxError=Math.max(maxError,Math.abs(hit.distance-Math.abs(Math.hypot(x-8,y-8)-4.31)));
  }
  errors.push(maxError);
 }
 expect(errors[2]!).toBeLessThan(.01);expect(errors[2]!).toBeLessThan(errors[0]!/4);
});
test('saddles, sign inversion and zero vertices are deterministic and owned',()=>{
 for(const v of [[2,-1,-1,2],[1,-2,-2,1],[1,-1,-1,1],[0,-1,1,0]]){
  const c=prepareScalarContour2D({width:2,height:2,spacing:1,values:new Float64Array(v)});
  for(const s of c.segments())expect(Number.isFinite(s)).toBe(true);
  if(v.every(x=>x!==0))expect(c.segments()).toEqual(prepareScalarContour2D({width:2,height:2,spacing:1,values:Float64Array.from(v,x=>-x)}).segments());
  const saved=c.nearest(.2,.3,2);c.segments().fill(999);expect(c.nearest(.2,.3,2)).toEqual(saved);
 }
 const input=grid(3,1,x=>x-.5),c=prepareScalarContour2D(input),saved=c.nearest(.2,.2,2);
 input.values.fill(100);expect(c.nearest(.2,.2,2)).toEqual(saved);
});
test('empty grids and allocation budgets never imply an invented boundary',()=>{
 for(const value of [-1,0,1]){
  const c=prepareScalarContour2D(grid(4,1,()=>value));expect(c.segmentCount).toBe(0);expect(c.nearest(1,1,2)).toBeNull();
 }
 expect(()=>prepareScalarContour2D({...grid(8,1,(x,y)=>(x+y)%2?1:-1),maxSegments:1})).toThrow('budget');
 for(const spacing of [0,-1,NaN,Infinity])expect(()=>prepareScalarContour2D(grid(3,spacing,()=>1))).toThrow();
 expect(()=>prepareScalarContour2D(grid(3,1,()=>NaN))).toThrow();
 expect(()=>prepareScalarContour2D({...grid(3,1,()=>1),width:2})).toThrow();
});
test('finite extreme scalar values retain subcell crossings without overflow',()=>{
 const c=prepareScalarContour2D({width:2,height:2,spacing:1,values:new Float64Array([-1e308,1e308,-1e308,1e308])});
 expect(c.nearest(0,.5,1)?.distance).toBe(.5);
});
test('overlapping halo tiles agree on metric distances at shared interior boundaries',()=>{
 const a=prepareScalarContour2D(grid(33,.25,(x,y)=>Math.hypot(x-6,y-4)-1.7));
 const b=prepareScalarContour2D(grid(33,.25,(x,y)=>Math.hypot(x+4-6,y-4)-1.7));
 for(const x of [4,4.125,5,6,7.9])for(const y of [2,3.3,4,5.7,6]){
  const p=a.nearest(x,y,1),q=b.nearest(x-4,y,1);
  expect(p===null).toBe(q===null);
  if(p&&q)expect(p.distance).toBeCloseTo(q.distance,12);
 }
});
test('bounded root refinement removes scalar scaling bias and shares crossing vertices',()=>{
 const f=(x:number,y:number)=>Math.expm1((x-.317)*7);
 const input=grid(9,.5,f),old=prepareScalarContour2D(input),c=prepareScalarContour2D({...input,sample:f,refinementSteps:14});
 expect(Math.abs(old.nearest(0,2,1)!.distance-.317)).toBeGreaterThan(.05);
 expect(c.nearest(0,2,1)!.distance).toBeCloseTo(.317,4);
 expect(c.refinedEdges).toBe(9);expect(c.refinementSamples).toBe(9*16);
 const s=c.segments();for(let i=4;i<s.length;i+=4)expect(s[i]).toBe(s[0]);
 expect(c.segmentCount).toBe(old.segmentCount);
});
test('refinement validates oracle agreement, finite samples and strict callback budgets',()=>{
 const input=grid(3,1,x=>x-.3);
 expect(()=>prepareScalarContour2D({...input,sample:()=>NaN})).toThrow('Nonfinite');
 expect(()=>prepareScalarContour2D({...input,sample:()=>1})).toThrow('signs');
 let calls=0;expect(()=>prepareScalarContour2D({...input,sample:x=>{calls++;return x-.3;},maxRefinementSamples:3})).toThrow('budget');expect(calls).toBe(3);
 expect(()=>prepareScalarContour2D({...input,refinementSteps:2})).toThrow();
 for(const refinementSteps of [-1,21,NaN,1.2])expect(()=>prepareScalarContour2D({...input,sample:x=>x-.3,refinementSteps})).toThrow();
 const exact=prepareScalarContour2D({...grid(3,1,x=>x-1),sample:x=>x-1});expect(exact.nearest(1,1,1)?.distance).toBe(0);
});

test('refinement handles horizontal transitions, discontinuities and opt-out without query callbacks',()=>{
 const input=grid(5,.5,(_,y)=>y<.317?-1:1);let calls=0;
 const sample=(_:number,y:number)=>{calls++;return y<.317?-1:1;};
 const c=prepareScalarContour2D({...input,sample,refinementSteps:16});
 expect(c.nearest(1,0,1)!.distance).toBeCloseTo(.317,5);
 expect(c.refinedEdges).toBe(5);const before=calls;
 for(let i=0;i<100;i++)c.nearest(i/100,0,1);
 expect(calls).toBe(before);
 expect(prepareScalarContour2D({...input,sample,refinementSteps:0,maxRefinementSamples:0}).segments()).toEqual(prepareScalarContour2D(input).segments());
 expect(calls).toBe(before);
});
test('refined curved contour retains hierarchy correctness and converges with cell resolution',()=>{
 const f=(x:number,y:number)=>Math.expm1((Math.hypot(x-4,y-4)-2.13)*3),errors=[];
 for(const spacing of [.5,.25]){
  const c=prepareScalarContour2D({...grid(8/spacing+1,spacing,f),sample:f,refinementSteps:16}),s=c.segments();let error=0;
  for(let i=0;i<120;i++){
   const x=4+3*Math.cos(i*.71),y=4+3*Math.sin(i*.71),hit=c.nearest(x,y,2)!;
   expect(hit).toEqual(brute(s,x,y,2));error=Math.max(error,Math.abs(hit.distance-.87));
  }
  errors.push(error);
 }
 expect(errors[1]!).toBeLessThan(errors[0]!/2);
});
