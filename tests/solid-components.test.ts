import { test, expect } from 'bun:test';
import { closedComponents, solidComponents, solidPointMembership } from '../src/index';
function cube(size: number, x = 0, inward = false) {
  const positions = Float64Array.from([-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1], (v,i) => v*size + (i%3===0 ? x : 0));
  const indices = Uint32Array.from([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
  if (inward) for(let i=0;i<indices.length;i+=3) [indices[i],indices[i+1]]=[indices[i+1]!,indices[i]!];
  return {positions,indices};
}
function combine(parts: ReturnType<typeof cube>[], ids = parts.map(() => 1)) {
  const p:number[]=[], i:number[]=[], owners:number[]=[];
  parts.forEach((part,k)=>{const offset=p.length/3;p.push(...part.positions);i.push(...Array.from(part.indices,n=>n+offset));owners.push(...Array(part.indices.length/3).fill(ids[k]));});
  return [Float64Array.from(p), Uint32Array.from(i), Int16Array.from(owners)] as const;
}
test('cavity walls stay with the surrounding material, separate same-owner pieces do not merge',()=>{
  const input=combine([cube(3),cube(1,0,true),cube(1,10)]), result=solidComponents(...input);
  expect(result.shells).toBe(3);expect(result.cavities).toBe(1);expect(result.components.length).toBe(2);
  expect(result.pointQueries).toBe(8);expect(result.triangleTests).toBe(96);
  const first=result.components[0]!, classify=solidPointMembership(first.positions,first.indices);
  expect(classify([0,0,0])).toBe('outside');expect(classify([2,0,0])).toBe('inside');expect(classify([1,0,0])).toBe('boundary');
  expect([...result.components.flatMap(c=>Array.from(c.sourceTriangles))].sort((a,b)=>a-b)).toEqual(Array.from({length:36},(_,i)=>i));
  expect(closedComponents(first.positions,first.indices).length).toBe(2);
});
test('nested material islands own their own cavities',()=>{
 const result=solidComponents(...combine([cube(5),cube(4,0,true),cube(2),cube(1,0,true)]));
 expect(result.components.length).toBe(2);expect(result.cavities).toBe(2);
 for(const c of result.components) expect(c.indices.length).toBe(72);
 expect(Array.from(result.components[0]!.sourceTriangles)).toEqual(Array.from({length:24},(_,i)=>i));
 expect(Array.from(result.components[1]!.sourceTriangles)).toEqual(Array.from({length:24},(_,i)=>i+24));
});
test('ownership, touching shells, orphan voids and work budgets fail explicitly',()=>{
 expect(()=>solidComponents(...combine([cube(3),cube(1,0,true)],[1,2]))).toThrow('no enclosing');
 expect(()=>solidComponents(...combine([cube(3),cube(1,2,true)]))).toThrow('Touching');
 expect(()=>solidComponents(...combine([cube(1,0,true)]))).toThrow('no enclosing');
 expect(()=>solidComponents(...combine([cube(3),cube(1,0,true)]),95)).toThrow('budget');
 const mixed=combine([cube(1)]); mixed[2][0]=2;
 expect(()=>solidComponents(...mixed)).toThrow('Mixed');
 const negative=combine([cube(1)],[-1]);expect(()=>solidComponents(...negative)).toThrow('Invalid');
});
test('translated coordinates and empty boundaries preserve semantics',()=>{
 const input=combine([cube(3,1000000),cube(1,1000000,true)]),result=solidComponents(...input);
 const c=result.components[0]!;
 expect(solidPointMembership(c.positions,c.indices)([1000000,0,0])).toBe('outside');
 expect(solidComponents(new Float64Array(),new Uint32Array(),new Int16Array()).components).toEqual([]);
 expect(()=>closedComponents(new Float64Array([0,0,0,1,0,0,0,1,0]),new Uint32Array([0,1,2]))).toThrow('Open');
});
