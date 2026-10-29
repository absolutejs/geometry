import {test,expect} from 'bun:test';
import {closeRectangularPatch} from '../src/closeRectangularPatch';
import {classifyMeshWitness} from '../src/classifyMeshWitness';
const patch=()=>closeRectangularPatch(new Float64Array([0,2,0,0,2,1,1,2,1,1,2,0]),new Uint32Array([0,1,2,0,2,3]),1,0);
test('analytic face/diagonal witnesses have the correct signed distance',()=>{
 const m=patch(),q=classifyMeshWitness(m.positions,m.indices,m.sourceTriangleCount);
 for(const height of [1,2,3]){const r=q([.5,height,.5],{point:[.5,2,.5],triangle:0});expect(r.kind).toBe('known');if(r.kind==='known')expect(r.signedDistance).toBe(height-2);}
 const r=q([.25,3,.5],{point:[.25,2,.5],triangle:0});expect(r.kind).toBe('known');if(r.kind==='known')expect(r.signedDistance).toBe(1);
});
test('synthetic faces and mixed material/synthetic edges are explicitly unknown',()=>{
 const m=patch(),q=classifyMeshWitness(m.positions,m.indices,m.sourceTriangleCount);
 expect(q([0,3,.5],{point:[0,2,.5],triangle:0})).toMatchObject({kind:'unknown',reason:'synthetic-boundary'});
 expect(q([0,3,0],{point:[0,2,0],triangle:0})).toMatchObject({kind:'unknown',reason:'synthetic-boundary'});
 expect(q([-.5,1,.5],{point:[0,1,.5],triangle:2})).toMatchObject({kind:'unknown',reason:'synthetic-boundary'});
});
test('invalid face identity rejects and an unrelated witness stays unresolved',()=>{
 const m=patch(),q=classifyMeshWitness(m.positions,m.indices,2);
 expect(()=>q([0,0,0],{point:[0,0,0],triangle:999})).toThrow();
 expect(q([.5,3,.5],{point:[.5,1,.5],triangle:0})).toMatchObject({kind:'unknown',reason:'unresolved-witness'});
});
test('query state owns source geometry after construction',()=>{
 const m=patch(),q=classifyMeshWitness(m.positions,m.indices,2);m.positions.fill(0);m.indices.fill(0);
 expect(q([.25,3,.5],{point:[.25,2,.5],triangle:0})).toMatchObject({kind:'known',classification:'outside',signedDistance:1});
});
