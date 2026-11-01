import {expect,test} from 'bun:test';
import {prepareTrianglePositiveQuadraticMoments} from '../src/trianglePositiveQuadraticMoments';
const triangle=[[0,0,0],[1,0,0],[0,1,0]] as const;
const query=prepareTrianglePositiveQuadraticMoments(triangle);
test('positive affine pressure integrates exact clipped powers and first moments',()=>{
 for(const a of [0,.1,.5,.9,1-2**-30,1]){
  const b=1-a,r=query([-a,b,-a]);
  expect(r.area).toBeCloseTo(b*b/2,14);
  if(b>0){
   expect(r.integral/(b**4/12)).toBeCloseTo(1,7);
   expect(r.cubicIntegral/(b**5/20)).toBeCloseTo(1,7);
   expect(r.relativeFirstMoment[0]/(a*b**4/12+b**5/20)).toBeCloseTo(1,7);
   expect(r.relativeFirstMoment[1]/(b**5/60)).toBeCloseTo(1,7);
  }else{expect(r.integral).toBe(0);expect(r.meanOffset).toBeNull();}
  const opposite=query([b,-a,b]);
  const i2=a*b**3/3+b**4/4,i3=a*b**4/4+b**5/5;
  expect(opposite.integral).toBeCloseTo(i2,14);
  expect(opposite.cubicIntegral).toBeCloseTo(i3,14);
  expect(opposite.relativeFirstMoment[0]).toBeCloseTo(b*i2-i3,14);
  expect(opposite.relativeFirstMoment[1]).toBeCloseTo((a*a*b**3/3+a*b**4/2+b**5/5)/2,14);
 }
});
test('constant, dry and threshold fields preserve exact scope and owned results',()=>{
 const r=query([2,2,2]);expect(r.integral).toBe(2);expect(r.cubicIntegral).toBe(4);
 expect(r.meanOffset![0]).toBeCloseTo(1/3,14);expect(r.meanOffset![1]).toBeCloseTo(1/3,14);
 for(const values of [[0,0,0],[-1,0,-1],[-1,-2,-3]]){const v=query(values);expect(v.area).toBe(0);expect(v.integral).toBe(0);expect(v.meanOffset).toBeNull();}
 r.reference[0]=99;r.surfaceNormal[2]=99;expect(query([2,2,2]).reference).toEqual([0,0,0]);expect(query([2,2,2]).surfaceNormal).toEqual([0,0,1]);
});
test('full positive fields agree with independent six-point degree-four quadrature',()=>{
 // Positive triangle quadrature documented in FEniCS Basix quadrature.cpp.
 const rules=[{a:.445948490915965,b:.108103018168070,w:.223381589678011},{a:.091576213509771,b:.816847572980459,w:.109951743655322}];
 for(const s of [[1,2,3],[.01,5,100],[7,7,2]]){
  let i2=0,i3=0,mx=0,my=0;
  for(const rule of rules)for(let j=0;j<3;j++){
   const l=[rule.a,rule.a,rule.a];l[j]=rule.b;
   const v=l.reduce((sum,x,k)=>sum+x*s[k]!,0),weight=rule.w*.5;
   i2+=weight*v*v;i3+=weight*v*v*v;mx+=weight*l[1]!*v*v;my+=weight*l[2]!*v*v;
  }
  const r=query(s);expect(r.integral/i2).toBeCloseTo(1,13);expect(r.cubicIntegral/i3).toBeCloseTo(1,13);
  expect(r.relativeFirstMoment[0]/mx).toBeCloseTo(1,13);expect(r.relativeFirstMoment[1]/my).toBeCloseTo(1,13);
 }
});
test('prepared triangles preserve translation, scale, winding and caller ownership',()=>{
 const p:[[number,number,number],[number,number,number],[number,number,number]]=[[1e12,2,3],[1e12+2,2,3],[1e12,2,5]];
 const q=prepareTrianglePositiveQuadraticMoments(p),r=q([1,2,3]);p[0][0]=0;
 const reference=query([1,2,3]);expect(r.integral/reference.integral).toBeCloseTo(4,13);expect(r.relativeFirstMoment[0]/reference.relativeFirstMoment[0]).toBeCloseTo(8,13);
 expect(r.relativeFirstMoment[2]/reference.relativeFirstMoment[1]).toBeCloseTo(8,13);expect(r.surfaceNormal).toEqual([0,-1,0]);expect(q([1,2,3]).reference[0]).toBe(1e12);
 const reversed=prepareTrianglePositiveQuadraticMoments([triangle[0],triangle[2],triangle[1]])([1,3,2]);expect(reversed.integral).toBeCloseTo(reference.integral,14);expect(reversed.surfaceNormal).toEqual([0,0,-1]);
});
test('invalid geometry, fields and nonrepresentable powers are rejected',()=>{
 expect(()=>prepareTrianglePositiveQuadraticMoments([[0,0,0],[1,0,0],[2,0,0]])).toThrow();
 for(const values of [[1,2],[1,2,NaN],[1e308,1e308,1e308],[1e-300,1e-300,1e-300]])expect(()=>query(values)).toThrow();
});

test('a second affine domain clips water depth before positive pressure',()=>{
 const a=query([-.5,.5,-.5],[.25,.25,-.75]);
 expect(a.integral).toBeCloseTo((.5**4-.25**4)/12,14);
 expect(a.cubicIntegral).toBeCloseTo((.5**5-.25**5)/20,14);
 expect(a.area).toBeCloseTo(.09375,14);
 expect(query([1,1,1],[1,1,1])).toEqual(query([1,1,1]));
 for(const domain of [[0,0,0],[-1,-2,-3],[-1,0,-1]]){
  const r=query([1,2,3],domain);expect(r.area).toBe(0);expect(r.integral).toBe(0);expect(r.meanOffset).toBeNull();
 }
 expect(()=>query([1,2,3],[1,NaN,2])).toThrow();
 expect(()=>query([1,2,3],[1,2])).toThrow();
});
test('two clipped affine fields are additive under independent surface refinement',()=>{
 const a=triangle[0],b=triangle[1],c=triangle[2],ab=[.5,0,0]as const,bc=[.5,.5,0]as const,ca=[0,.5,0]as const;
 for(const values of [[-.3,.7,-.3],[.4,-.6,.9],[2,3,1]])for(const domain of [[.2,.2,-.8],[-.1,.9,.4],[1,1,1]]){
  const target=query(values,domain),pieces=[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];
  let i2=0,i3=0,area=0;const moment=[0,0,0];
  for(const piece of pieces){
   const interp=(p:readonly number[],s:number[])=>s[0]!*(1-p[0]!-p[1]!)+s[1]!*p[0]!+s[2]!*p[1]!;
   const r=prepareTrianglePositiveQuadraticMoments(piece)(piece.map(p=>interp(p,values)),piece.map(p=>interp(p,domain)));
   i2+=r.integral;i3+=r.cubicIntegral;area+=r.area;
   for(let d=0;d<3;d++)moment[d]!+=r.relativeFirstMoment[d]!+r.reference[d]!*r.integral;
  }
  expect(i2).toBeCloseTo(target.integral,13);expect(i3).toBeCloseTo(target.cubicIntegral,13);expect(area).toBeCloseTo(target.area,13);
  for(let d=0;d<3;d++)expect(moment[d]).toBeCloseTo(target.relativeFirstMoment[d]!,13);
 }
});

test('nonnegative full domains retain boundary zeros without treating a zero field as wet',()=>{
 for(const values of [[0,1,0],[1,0,2],[1e-90,2e-90,3e-90],[1,2,3]]){
  const full=query(values);
  for(const domain of [[0,1,0],[1,0,0],[0,0,1],[0,Number.MIN_VALUE,0],[0,1e300,2e300]])
   expect(query(values,domain)).toEqual(full);
  const dry=query(values,[0,0,0]);expect(dry.area).toBe(0);expect(dry.meanOffset).toBeNull();
 }
 const linear=query([0,1,0],[0,1,0]);
 expect(linear.area).toBe(.5);expect(linear.integral).toBeCloseTo(1/12,15);
 expect(linear.cubicIntegral).toBeCloseTo(1/20,15);
 expect(linear.relativeFirstMoment[0]).toBeCloseTo(1/20,15);
 expect(linear.relativeFirstMoment[1]).toBeCloseTo(1/60,15);
});
