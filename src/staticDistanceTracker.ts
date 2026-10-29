type Point=readonly [number,number,number];
type Distance={kind:'known';signedDistance:number}|{kind:'unknown'};
export type TrackedDistance={kind:'known';lowerBound:number;sampled:boolean}|{kind:'unknown';sampled:true};
/** Bounded point-distance cache for a static, correctly signed distance oracle.
 * Positive distances shrink by point displacement and caller-selected numerical
 * padding. Only a still-positive bound skips a query. This certifies neither
 * motion between samples nor an oracle's geometry/sign correctness. Reset when
 * its geometry changes; unknowns and failures invalidate the affected point. */
export function createStaticDistanceTracker(query:(point:Point)=>Distance,options:{maximumPoints:number;roundoffPadding:number;withinDomain?:(point:Point)=>boolean}){
 if(typeof query!=='function'||!options||!Number.isSafeInteger(options.maximumPoints)||options.maximumPoints<1||options.maximumPoints>65536||!Number.isFinite(options.roundoffPadding)||options.roundoffPadding<=0||(options.withinDomain!==undefined&&typeof options.withinDomain!=='function'))throw Error('Invalid static distance tracker');
 const maximumPoints=options.maximumPoints,padding=options.roundoffPadding,withinDomain=options.withinDomain;
 const states:({point:Point;bound:number}|undefined)[]=new Array(maximumPoints);
 let trackedPoints=0,queries=0,propagated=0,unknowns=0,failures=0,resets=0,domainRejections=0;
 const clear=(id:number)=>{if(states[id]){states[id]=undefined;trackedPoints--;}};
 return {
  sample(id:number,point:Point):TrackedDistance{
   if(!Number.isSafeInteger(id)||id<0||id>=maximumPoints||!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw Error('Invalid tracked distance point');
   const owned:Point=[point[0],point[1],point[2]],prior=states[id];
   if(withinDomain){
    try{
     const eligible=withinDomain([...owned]);
     if(typeof eligible!=='boolean')throw Error('Invalid distance domain result');
     if(!eligible){clear(id);unknowns++;domainRejections++;return{kind:'unknown',sampled:true};}
    }catch(error){clear(id);failures++;throw error;}
   }
   if(prior){const movement=Math.hypot(...owned.map((x,k)=>x-prior.point[k]!)),bound=prior.bound-movement-padding;
    if(Number.isFinite(bound)&&bound>padding){states[id]={point:owned,bound};propagated++;return{kind:'known',lowerBound:bound,sampled:false};}
   }
   clear(id);queries++;
   try{
    // The callback cannot mutate the retained point through its borrowed tuple.
    const result=query([...owned]);
    if(!result||!(result.kind==='known'||result.kind==='unknown'))throw Error('Invalid distance result');
    if(result.kind==='unknown'){unknowns++;return{kind:'unknown',sampled:true};}
    if(!Number.isFinite(result.signedDistance))throw Error('Nonfinite signed distance');
    const bound=result.signedDistance-padding;if(!Number.isFinite(bound))throw Error('Nonfinite distance bound');
    states[id]={point:owned,bound};trackedPoints++;
    return{kind:'known',lowerBound:bound,sampled:true};
   }catch(error){failures++;throw error;}
  },
  reset(){states.fill(undefined);trackedPoints=0;resets++;},
  snapshot(){return{maximumPoints,roundoffPadding:padding,trackedPoints,queries,propagated,unknowns,failures,resets,domainRejections,domainGuard:!!withinDomain};}
 };
}
