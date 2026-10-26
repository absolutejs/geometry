import { expect, test } from 'bun:test';
import { axialOrientationTensor, type WeightedAxis } from '../src/axialOrientation';
const close = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  expect(a.length).toBe(b.length);
  for(let i=0;i<a.length;i++) expect(Math.abs(a[i]!-b[i]!)).toBeLessThan(2e-14);
};
test('opposite fibre axes reinforce instead of cancelling; analytic isotropic and planar mixtures',()=>{
  close(axialOrientationTensor([{axis:[1,0,0],weight:1},{axis:[-3,0,0],weight:1}]),[1,0,0,0,0,0,0,0,0]);
  const axes:WeightedAxis[]=[{axis:[1,0,0],weight:1},{axis:[0,1,0],weight:1},{axis:[0,0,1],weight:1}];
  close(axialOrientationTensor(axes),[1/3,0,0,0,1/3,0,0,0,1/3]);
  close(axialOrientationTensor(axes.slice(0,2)),[.5,0,0,0,.5,0,0,0,0]);
});
test('finite extremes and weight scaling preserve the second moment',()=>{
  for(const scale of [Number.MIN_VALUE,1e-300,1,1e300,Number.MAX_VALUE]){
    close(axialOrientationTensor([{axis:[scale,scale,0],weight:scale}]),[.5,.5,0,.5,.5,0,0,0,0]);
  }
  const q=axialOrientationTensor([{axis:[1,0,0],weight:1},{axis:[0,1,0],weight:3}]);
  close(q,[.25,0,0,0,.75,0,0,0,0]);
  const many=Array.from({length:4096},(_,i)=>({axis:[1,i%3-1,0] as const,weight:1}));
  close(axialOrientationTensor(many),axialOrientationTensor([...many].reverse()));
});
test('rotation covariance, positive directional response and sign independence',()=>{
  for(let i=0;i<160;i++){
    const angle=i*.213,c=Math.cos(angle),s=Math.sin(angle);
    const samples:WeightedAxis[]=[{axis:[1,2,3],weight:2},{axis:[-2,1,.1],weight:3},{axis:[0,0,1],weight:1}];
    const saved=JSON.stringify(samples),q=axialOrientationTensor(samples);
    const r=[c,-s,0,s,c,0,0,0,1];
    const rotated=samples.map(a=>({weight:a.weight,axis:[c*a.axis[0]-s*a.axis[1],s*a.axis[0]+c*a.axis[1],a.axis[2]] as const}));
    const expected=Array.from({length:9},(_,ij)=>{
      const row=Math.floor(ij/3),col=ij%3;let sum=0;
      for(let k=0;k<3;k++)for(let l=0;l<3;l++)sum+=r[row*3+k]!*q[k*3+l]!*r[col*3+l]!;
      return sum;
    });
    close(axialOrientationTensor(rotated),expected);
    close(axialOrientationTensor(samples.map(a=>({weight:a.weight,axis:a.axis.map(v=>-v) as [number,number,number]}))),q);
    expect(JSON.stringify(samples)).toBe(saved);
    expect(q[0]!+q[4]!+q[8]!).toBeCloseTo(1,14);
    const n=[c,s,0];let response=0;
    for(let k=0;k<3;k++)for(let l=0;l<3;l++)response+=n[k]!*q[k*3+l]!*n[l]!;
    expect(response).toBeGreaterThanOrEqual(0);expect(response).toBeLessThanOrEqual(1);
  }
});
test('rejects absent orientation and malformed data rather than choosing an arbitrary axis',()=>{
  for(const value of [[],[{axis:[0,0,0],weight:1}],[{axis:[1,0,0],weight:0}],[{axis:[1,0,0],weight:-1}],[{axis:[NaN,1,0],weight:1}],[{axis:[1,0,0],weight:Infinity}],Array(4097).fill({axis:[1,0,0],weight:1})])
    expect(()=>axialOrientationTensor(value as WeightedAxis[])).toThrow();
});
