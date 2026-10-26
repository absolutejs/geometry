import {expect,test} from 'bun:test';
import {solidPointMembership} from '../src/solidPointMembership';
import {readFileSync} from 'node:fs';
const vertices=[0,0,0,1,0,0,1,1,0,0,1,0,0,0,1,1,0,1,1,1,1,0,1,1];
const other=[0,3,2,0,2,1,4,5,6,4,6,7,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
const faces=new Uint32Array([...other,0,1,8,1,5,8,5,4,8,4,0,8]);
test('thin and collinear subdivisions preserve closed-cube membership without area cutoffs',()=>{
 for(const height of [0,1e-18,1e-100,1e-200,1e-300,.25]){
  const p=new Float64Array([...vertices,.5,0,height]);
  const before=p.slice(),classify=solidPointMembership(p,faces);
  expect(classify([.5,.5,.5])).toBe('inside');
  expect(classify([.5,-1e-6,.5])).toBe('outside');
  expect(classify([.5,0,height])).toBe('boundary');
  expect(classify([.25,0,0])).toBe('boundary');
  expect(classify([.5,1e-6,.5])).toBe('inside');
  expect(p).toEqual(before);
 }
});
test('captured native pine cut with a 1.3e-34 squared face area supports boundary queries',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/thin-pine-cut.json',import.meta.url),'utf8'));
 const p=Float64Array.from(fixture.positions),indices=Uint32Array.from(fixture.indices);
 const classify=solidPointMembership(p,indices);
 for(let i=0;i<p.length;i+=3)expect(classify([p[i]!,p[i+1]!,p[i+2]!])).toBe('boundary');
 const max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++)max[i%3]=Math.max(max[i%3]!,p[i]!);
 expect(classify([max[0]!+1,max[1]!+1,max[2]!+1])).toBe('outside');
});
