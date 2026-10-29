import {test,expect} from 'bun:test';
import {createStaticDistanceTracker} from '../src/staticDistanceTracker';
test('sphere distance lower bounds survive approach, crossing, exit and discontinuous motion',()=>{
 const sdf=(p:readonly number[])=>Math.hypot(...p)-1;
 const tracker=createStaticDistanceTracker(p=>({kind:'known',signedDistance:sdf(p)}),{maximumPoints:3,roundoffPadding:1e-8});
 for(let i=0;i<2000;i++)for(let id=0;id<3;id++){
  const x=id===0?3-i*.002:id===1?Math.cos(i*.01)*2:(i%71===0?-2:2);
  const p:[number,number,number]=[x,id===1?Math.sin(i*.01)*2:0,0],r=tracker.sample(id,p);expect(r.kind).toBe('known');if(r.kind==='known')expect(r.lowerBound).toBeLessThanOrEqual(sdf(p)+1e-12);
 }
 expect(tracker.snapshot().propagated).toBeGreaterThan(1000);expect(tracker.snapshot().trackedPoints).toBe(3);
});
test('unknown results and thrown queries invalidate state; explicit reset handles geometry changes',()=>{
 let mode:'known'|'unknown'|'throw'='known',calls=0;
 const t=createStaticDistanceTracker(()=>{calls++;if(mode==='throw')throw Error('fixture');return mode==='known'?{kind:'known',signedDistance:1}:{kind:'unknown'};},{maximumPoints:1,roundoffPadding:1e-7});
 t.sample(0,[0,0,0]);mode='unknown';expect(t.sample(0,[2,0,0]).kind).toBe('unknown');expect(t.snapshot().trackedPoints).toBe(0);
 mode='throw';expect(()=>t.sample(0,[2,0,0])).toThrow('fixture');expect(t.snapshot().trackedPoints).toBe(0);
 mode='known';t.sample(0,[2,0,0]);t.reset();t.sample(0,[2,0,0]);expect(calls).toBe(5);expect(t.snapshot()).toMatchObject({unknowns:1,failures:1,resets:1});
});
test('caller, callback and returned stats cannot alias tracker state',()=>{
 const t=createStaticDistanceTracker(p=>{(p as number[])[0]=99;return{kind:'known',signedDistance:10};},{maximumPoints:1,roundoffPadding:1e-7});
 const p:[number,number,number]=[0,0,0];t.sample(0,p);p[0]=500;const stats=t.snapshot();stats.trackedPoints=99;
 expect(t.sample(0,[0,0,0])).toMatchObject({kind:'known',sampled:false});expect(t.snapshot().trackedPoints).toBe(1);
});
test('invalid identifiers and nonfinite oracle output never expand the point budget',()=>{
 const t=createStaticDistanceTracker(()=>({kind:'known',signedDistance:NaN}),{maximumPoints:1,roundoffPadding:1e-7});
 expect(()=>t.sample(1,[0,0,0])).toThrow();expect(()=>t.sample(0,[0,0,0])).toThrow();expect(t.snapshot().trackedPoints).toBe(0);
 expect(()=>createStaticDistanceTracker(()=>({kind:'unknown'}),{maximumPoints:65537,roundoffPadding:1e-7})).toThrow();
});

test('domain is checked before propagation and invalidates cached positive bounds',()=>{
 let calls=0;
 const t=createStaticDistanceTracker(()=>{calls++;return{kind:'known',signedDistance:10};},{maximumPoints:1,roundoffPadding:1e-7,withinDomain:p=>p[0]<=1});
 t.sample(0,[0,0,0]);expect(t.sample(0,[1.1,0,0])).toEqual({kind:'unknown',sampled:true});
 expect(t.snapshot()).toMatchObject({trackedPoints:0,queries:1,domainRejections:1,unknowns:1,domainGuard:true});
 expect(t.sample(0,[0,0,0])).toMatchObject({kind:'known',sampled:true});expect(calls).toBe(2);
});
test('domain callback cannot mutate retained coordinates and errors invalidate prior state',()=>{
 let mode='valid';
 const t=createStaticDistanceTracker(p=>({kind:'known',signedDistance:10-p[0]}),{maximumPoints:1,roundoffPadding:1e-7,withinDomain:p=>{
  (p as number[])[0]=99;if(mode==='throw')throw Error('domain fixture');return mode==='invalid'?undefined as unknown as boolean:true;
 }});
 expect(t.sample(0,[0,0,0])).toMatchObject({lowerBound:10-1e-7});
 expect(t.sample(0,[0,0,0])).toMatchObject({sampled:false});mode='throw';expect(()=>t.sample(0,[0,0,0])).toThrow('domain fixture');
 expect(t.snapshot().trackedPoints).toBe(0);mode='valid';t.sample(0,[0,0,0]);mode='invalid';expect(()=>t.sample(0,[0,0,0])).toThrow('Invalid distance domain result');
 expect(t.snapshot()).toMatchObject({trackedPoints:0,failures:2});
});
