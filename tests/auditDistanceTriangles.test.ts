import {test,expect} from 'bun:test';
import {auditDistanceTriangles as audit} from '../src/auditDistanceTriangles';
const faces=new Uint32Array([0,1,2]);
const options={penetrationTolerance:.01,maximumQueries:10000,maximumDepth:24,roundoffPadding:1e-9};
test('face interior detects a sphere missed by all three clear vertices',()=>{
 const p=new Float64Array([-2,0,-1,2,0,-1,0,0,2]);
 const sdf=(p:readonly number[])=>Math.hypot(...p)-.5;
 for(let i=0;i<p.length;i+=3)expect(sdf(Array.from(p.slice(i,i+3)))).toBeGreaterThan(0);
 expect(audit(p,faces,p=>({kind:'known',signedDistance:sdf(p),errorBound:1e-10}),options)).toMatchObject({kind:'penetrating',triangle:0,queries:1});
});
test('adaptive subdivision certifies an entire surface above an analytic plane',()=>{
 const p=new Float64Array([0,.1,0,1,.1,0,0,.1,1]);
 const r=audit(p,faces,p=>({kind:'known',signedDistance:p[1],errorBound:1e-10}),options);
 expect(r.kind).toBe('clear');expect(r.queries).toBeGreaterThan(1);expect(r.certifiedLeaves).toBeGreaterThan(1);
});
test('uncertainty and exhausted budgets never become a clearance result',()=>{
 const p=new Float64Array([0,0,0,1,0,0,0,0,1]);
 const q=()=>({kind:'known' as const,signedDistance:-.02,errorBound:.02});
 expect(audit(p,faces,q,{...options,maximumDepth:0})).toMatchObject({kind:'unknown',reason:'depth-budget'});
 expect(audit(p,faces,q,{...options,maximumQueries:1})).toMatchObject({kind:'unknown',reason:'query-budget'});
 expect(audit(p,faces,()=>({kind:'unknown'}),options)).toMatchObject({kind:'unknown',reason:'oracle'});
 expect(()=>audit(p,faces,()=>({kind:'known',signedDistance:0,errorBound:-1}),options)).toThrow();
});
test('oracle cannot mutate the reported witness and invalid geometry rejects',()=>{
 const p=new Float64Array([0,0,0,3,0,0,0,0,3]);
 expect(audit(p,faces,point=>{(point as number[])[0]=99;return{kind:'known',signedDistance:-1,errorBound:0};},options)).toMatchObject({kind:'penetrating',point:[1,0,1]});
 expect(()=>audit(p,new Uint32Array([0,1,7]),()=>({kind:'unknown'}),options)).toThrow();
});

test('callback mutation cannot replace later source triangles',()=>{
 const p=new Float64Array([0,10,0,1,10,0,0,10,1,0,-10,0,1,-10,0,0,-10,1]),f=new Uint32Array([0,1,2,3,4,5]);
 const r=audit(p,f,point=>{p.fill(99);f.fill(0);return{kind:'known',signedDistance:point[1],errorBound:1e-10};},options);
 expect(r).toMatchObject({kind:'penetrating',triangle:1,queries:2});
});
