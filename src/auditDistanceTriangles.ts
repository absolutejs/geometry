type Point=readonly[number,number,number];
type Sample={kind:'known';signedDistance:number;errorBound:number}|{kind:'unknown'};
/** Conservative surface-only audit against a static 1-Lipschitz signed distance.
 * Requires a trustworthy oracle error bound and caller-selected arithmetic padding. Does not certify enclosed volumes
 * or motion between poses. Resource exhaustion is unknown, never success. */
export function auditDistanceTriangles(positions:Float64Array,indices:Uint32Array,query:(point:Point)=>Sample,options:{penetrationTolerance:number;maximumQueries:number;maximumDepth:number;roundoffPadding:number}){
 if(!(positions instanceof Float64Array)||!positions.length||positions.length%3||!(indices instanceof Uint32Array)||!indices.length||indices.length%3||!positions.every(Number.isFinite)||indices.some(i=>i>=positions.length/3)||typeof query!=='function'||!options||!Number.isFinite(options.penetrationTolerance)||options.penetrationTolerance<0||!Number.isSafeInteger(options.maximumQueries)||options.maximumQueries<1||options.maximumQueries>1000000||!Number.isSafeInteger(options.maximumDepth)||options.maximumDepth<0||options.maximumDepth>32||!Number.isFinite(options.roundoffPadding)||options.roundoffPadding<=0)throw Error('Invalid distance surface audit');
 const tolerance=options.penetrationTolerance,budget=options.maximumQueries,depthLimit=options.maximumDepth,padding=options.roundoffPadding;
 const ownedPositions=positions.slice(),ownedIndices=indices.slice();
 let queries=0,certifiedLeaves=0,maximumDepth=0;
 const point=(i:number):Point=>[ownedPositions[i*3]!,ownedPositions[i*3+1]!,ownedPositions[i*3+2]!];
 const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const stats=()=>({queries,certifiedLeaves,maximumDepth});
 for(let triangle=0;triangle<ownedIndices.length/3;triangle++){
  const stack:{p:readonly[Point,Point,Point];depth:number}[]=[{p:[point(ownedIndices[triangle*3]!),point(ownedIndices[triangle*3+1]!),point(ownedIndices[triangle*3+2]!)],depth:0}];
  while(stack.length){
   const {p,depth}=stack.pop()!;maximumDepth=Math.max(maximumDepth,depth);
   if(queries>=budget)return{kind:'unknown' as const,reason:'query-budget' as const,triangle,...stats()};
   // Divide before adding to avoid overflowing otherwise finite coordinates.
   const center:Point=[0,1,2].map(k=>p[0][k]!/3+p[1][k]!/3+p[2][k]!/3) as unknown as Point;
   const radius=Math.max(...p.map(v=>distance(v,center)));
   if(!Number.isFinite(radius))return{kind:'unknown' as const,reason:'numerical-range' as const,triangle,...stats()};
   const result=query([...center]);queries++;
   if(!result||!['known','unknown'].includes(result.kind))throw Error('Invalid distance surface result');
   if(result.kind==='unknown')return{kind:'unknown' as const,reason:'oracle' as const,triangle,...stats()};
   if(!Number.isFinite(result.signedDistance)||!Number.isFinite(result.errorBound)||result.errorBound<0)throw Error('Invalid distance surface uncertainty');
   if(result.signedDistance+result.errorBound+padding < -tolerance)return{kind:'penetrating' as const,triangle,point:center,upperBound:result.signedDistance+result.errorBound+padding,...stats()};
   if(result.signedDistance-result.errorBound-radius-padding>=-tolerance){certifiedLeaves++;continue;}
   if(depth>=depthLimit)return{kind:'unknown' as const,reason:'depth-budget' as const,triangle,...stats()};
   const lengths=[distance(p[0],p[1]),distance(p[1],p[2]),distance(p[2],p[0])],edge=lengths.indexOf(Math.max(...lengths)),a=p[edge]!,b=p[(edge+1)%3]!,c=p[(edge+2)%3]!;
   const midpoint:Point=[a[0]/2+b[0]/2,a[1]/2+b[1]/2,a[2]/2+b[2]/2];
   stack.push({p:[a,midpoint,c],depth:depth+1},{p:[midpoint,b,c],depth:depth+1});
  }
 }
 return{kind:'clear' as const,penetrationTolerance:tolerance,...stats()};
}
