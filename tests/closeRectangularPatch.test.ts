import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {closeRectangularPatch} from '../src/closeRectangularPatch';
import {closedComponents} from '../src/closedComponents';
import {solidPointMembership} from '../src/solidPointMembership';
function patch(axis:0|1|2=1,cells=1,translation=0,stretch=1,bowl=false){
 const p:number[]=[],f:number[]=[],u=(axis+1)%3,v=(axis+2)%3;
 for(let y=0;y<=cells;y++)for(let x=0;x<=cells;x++){
  const q=[translation,translation,translation],a=x/cells,b=y/cells;
  q[u]!+=a*stretch;q[v]!+=b/stretch;q[axis]!+=bowl?2-.5*Math.sin(a*Math.PI)*Math.sin(b*Math.PI):2+.1*a+.2*b;p.push(...q);
 }
 for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){const a=y*(cells+1)+x,b=a+1,c=a+cells+1,d=c+1;f.push(a,b,d,a,d,c);}
 return {positions:Float64Array.from(p),indices:Uint32Array.from(f)};
}
for(const axis of [0,1,2] as const)test('owned oriented closure and analytic volume on axis '+axis,()=>{
 const input=patch(axis,4),p=input.positions.slice(),f=input.indices.slice(),result=closeRectangularPatch(input.positions,input.indices,axis,0);
 expect(result.volume).toBeCloseTo(2.15,12);expect(result.syntheticTriangleCount).toBe(48);expect(result.sourceTriangleCount).toBe(32);
 expect(result.positions.slice(0,p.length)).toEqual(p);expect(result.indices.slice(0,f.length)).toEqual(f);expect(input.positions).toEqual(p);expect(input.indices).toEqual(f);expect(closedComponents(result.positions,result.indices)).toHaveLength(1);
 const membership=solidPointMembership(result.positions,result.indices),q:[number,number,number]=[.5,.5,.5];q[axis]=1;expect(membership(q)).toBe('inside');q[axis]=3;expect(membership(q)).toBe('outside');q[axis]=0;expect(membership(q)).toBe('boundary');
 input.positions.fill(0);input.indices.fill(0);expect(result.positions.slice(0,p.length)).toEqual(p);expect(result.indices.slice(0,f.length)).toEqual(f);
});
test('concave interior depression retains solid/air classification',()=>{
 const p=patch(1,8,0,1,true),r=closeRectangularPatch(p.positions,p.indices,1,0),inside=solidPointMembership(r.positions,r.indices);
 expect(inside([.5,1,.5])).toBe('inside');expect(inside([.5,1.75,.5])).toBe('outside');expect(inside([.5,1.5,.5])).toBe('boundary');
});
test('large translation and thin projected footprint retain analytic volume',()=>{
 for(const [translation,stretch,tolerance] of [[1e7,1,7],[0,1e-8,10]] as const){const p=patch(1,1,translation,stretch);expect(closeRectangularPatch(p.positions,p.indices,1,translation).volume).toBeCloseTo(2.15,tolerance);}
});
test('holes, reversed boundary, nonmanifold faces, invalid base and degenerate faces reject',()=>{
 const p=patch(1,3);const hole=Uint32Array.from([...p.indices.slice(0,24),...p.indices.slice(30)]);
 expect(()=>closeRectangularPatch(p.positions,hole,1,0)).toThrow();
 const reverse=p.indices.slice();for(let i=0;i<reverse.length;i+=3)[reverse[i+1],reverse[i+2]]=[reverse[i+2]!,reverse[i+1]!];expect(()=>closeRectangularPatch(p.positions,reverse,1,0)).toThrow();
 expect(()=>closeRectangularPatch(p.positions,Uint32Array.from([...p.indices,...p.indices.slice(0,3)]),1,0)).toThrow();
 expect(()=>closeRectangularPatch(p.positions,p.indices,1,2)).toThrow();
 const bad=p.positions.slice();bad.set(bad.slice(0,3),3);expect(()=>closeRectangularPatch(bad,p.indices,1,0)).toThrow();
});
test('retained actual terrain closes without changing any source triangle coordinates',()=>{
 const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/terrain-inspection-patch.json.gz',import.meta.url))).toString());
 // This one generated surface's tile seam duplicates are exact coordinates.
 // Construct its explicit index ancestry here; the closure itself never welds.
 const ids=new Map<string,number>(),map:number[]=[],points:number[]=[];
 for(let i=0;i<fixture.positions.length;i+=3){const p=fixture.positions.slice(i,i+3),key=p.join(',');let id=ids.get(key);if(id===undefined){id=ids.size;ids.set(key,id);points.push(...p);}map.push(id);}
 const p=Float64Array.from(points),f=Uint32Array.from(fixture.indices.map((i:number)=>map[i]!));let low=Infinity;for(let i=1;i<p.length;i+=3)low=Math.min(low,p[i]!);
 const r=closeRectangularPatch(p,f,1,low-2);expect(r.sourceTriangleCount).toBe(8234);expect(r.boundary.length).toBe(258);expect(r.syntheticTriangleCount).toBe(774);expect(r.volume).toBeGreaterThan(0);expect(closedComponents(r.positions,r.indices)).toHaveLength(1);
 expect(r.positions.slice(0,p.length)).toEqual(p);expect(r.indices.slice(0,f.length)).toEqual(f);
 const membership=solidPointMembership(r.positions,r.indices);expect(membership([0,low-1,0])).toBe('inside');let high=-Infinity;for(let i=1;i<p.length;i+=3)high=Math.max(high,p[i]!);expect(membership([0,high+1,0])).toBe('outside');
});
