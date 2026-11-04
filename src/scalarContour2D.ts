export type ScalarContour2DInput = {
  /** Row-major samples at grid vertices; zero is the contour. Coordinates are local metres. */
  values: Float32Array | Float64Array;
  width: number;
  height: number;
  spacing: number;
  /** Hard output/work limit, checked before construction. Default 131072 segments. */
  maxSegments?: number;
  /** Optional local-coordinate scalar oracle. Must agree with grid vertex signs.
   * Used only on sign-changing edges; does not discover subcell closed features. */
  sample?: (x: number, y: number) => number;
  /** Bisection steps per crossing edge, 0..20. Default 12 when sample is supplied. */
  refinementSteps?: number;
  /** Hard oracle evaluation budget, default 65536, maximum 1048576. */
  maxRefinementSamples?: number;
};
export type ContourHit2D = { distance: number; x: number; y: number; segment: number };
/** A piecewise-linear sign-change contour, not an exact SDF of the original function.
 * Zero belongs to the nonnegative side; tangencies without a sign change are omitted.
 * Does not infer solid membership. Empty or out-of-radius queries return null.
 * Queries outside the sampled domain are rejected: missing neighbours are not empty space.
 */
export function prepareScalarContour2D(input: ScalarContour2DInput) {
  const {values, width, height, spacing} = input;
  const limit=input.maxSegments ?? 131072;
  const steps=input.refinementSteps ?? (input.sample ? 12 : 0);
  const sampleLimit=input.maxRefinementSamples ?? 65536;
  if (!Number.isInteger(steps)||steps<0||steps>20||
      (input.sample!==undefined&&typeof input.sample!=='function')||
      (steps>0&&!input.sample)||!Number.isSafeInteger(sampleLimit)||sampleLimit<0||sampleLimit>1048576)
    throw new RangeError('Invalid contour refinement configuration');
  if (!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<2||height<2||
      width*height>262144||values.length!==width*height||
      !(values instanceof Float32Array || values instanceof Float64Array)||
      !Number.isFinite(spacing)||spacing<1e-9||spacing>1e6||
      !Number.isSafeInteger(limit)||limit<0||limit>524288)
    throw new RangeError('Invalid contour grid or budget');
  for(const v of values) if(!Number.isFinite(v)) throw new RangeError('Nonfinite contour sample');
  const maxX=(width-1)*spacing,maxY=(height-1)*spacing;
  // Count first: no segment output allocation before checking its hard budget.
  let count=0,ambiguousCells=0,zeroPlateauCells=0;
  for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){
    const i=y*width+x;
    if(values[i]===0&&values[i+1]===0&&values[i+width]===0&&values[i+width+1]===0)zeroPlateauCells++;
    const signs=[values[i]!>=0,values[i+1]!>=0,values[i+width+1]!>=0,values[i+width]!>=0];
    let crossings=0;for(let e=0;e<4;e++) if(signs[e]!==signs[(e+1)%4])crossings++;
    count+=crossings/2;if(crossings===4)ambiguousCells++;
    if(count>limit)throw new RangeError('Contour segment budget exceeded');
  }
  const segments=new Float64Array(count*4);
  const refined=new Map<number,number[]>();
  let refinementSamples=0;
  const sample=(x:number,y:number)=>{
    if(refinementSamples>=sampleLimit)throw new RangeError('Contour refinement sample budget exceeded');
    refinementSamples++;
    const value=input.sample!(x,y);
    if(!Number.isFinite(value))throw new RangeError('Nonfinite contour refinement sample');
    return value;
  };
  let used=0;
  for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){
    const i=y*width+x,v=[values[i]!,values[i+1]!,values[i+width+1]!,values[i+width]!];
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    const edges: number[]=[];const points: number[][]=[];
    for(let e=0;e<4;e++){
      const n=(e+1)%4;
      if((v[e]!>=0)===(v[n]!>=0))continue;
      // Scale before interpolation so opposite finite extrema cannot overflow.
      const scale=Math.max(Math.abs(v[e]!),Math.abs(v[n]!));
      const a=v[e]!/scale,b=v[n]!/scale,t=a/(a-b);
      edges.push(e);
      if(steps===0){points[e]=[
        (corners[e]![0]!+(corners[n]![0]!-corners[e]![0]!)*t)*spacing,
        (corners[e]![1]!+(corners[n]![1]!-corners[e]![1]!)*t)*spacing
      ];continue;}
      const ia=corners[e]![1]!*width+corners[e]![0]!,ib=corners[n]![1]!*width+corners[n]![0]!;
      const first=Math.min(ia,ib),last=Math.max(ia,ib),key=first*2+(last-first===width?1:0);
      const cached=refined.get(key);if(cached){points[e]=cached;continue;}
      const ax=(first%width)*spacing,ay=Math.floor(first/width)*spacing;
      const bx=(last%width)*spacing,by=Math.floor(last/width)*spacing;
      const va=sample(ax,ay),vb=sample(bx,by);
      if((va>=0)!==(values[first]!>=0)||(vb>=0)!==(values[last]!>=0))
        throw new Error('Contour refinement oracle disagrees with grid signs');
      let lo=0,hi=1;
      if(va===0)hi=0;else if(vb===0)lo=1;
      else for(let iteration=0;iteration<steps;iteration++){
        const mid=(lo+hi)/2,value=sample(ax+(bx-ax)*mid,ay+(by-ay)*mid);
        if(value===0){lo=hi=mid;break;}
        if((value>=0)===(va>=0))lo=mid;else hi=mid;
      }
      const fraction=(lo+hi)/2,point=[ax+(bx-ax)*fraction,ay+(by-ay)*fraction];
      refined.set(key,point);points[e]=point;
    }
    const add=(a:number,b:number)=>{
      const p=points[a]!,q=points[b]!;
      segments.set([p[0]!,p[1]!,q[0]!,q[1]!],used++*4);
    };
    if(edges.length===2)add(edges[0]!,edges[1]!);
    if(edges.length===4){
      const scale=Math.max(...v.map(Math.abs));
      const q=(v[0]!/scale)*(v[2]!/scale)-(v[1]!/scale)*(v[3]!/scale);
      // Asymptotic decider; exact saddles use a deterministic diagonal.
      if(q>=0){add(0,1);add(2,3);}else{add(0,3);add(1,2);}
    }
  }
  const refinedEdges=refined.size;refined.clear();
  // Flat binary hierarchy; leaves contain <=8 segments. No recursion during queries.
  const order=Uint32Array.from({length:count},(_,i)=>i);
  const bounds=new Float64Array(Math.max(1,2*count)*4);
  const nodes=new Int32Array(Math.max(1,2*count)*4);
  let nodeCount=0;
  const build=(start:number,end:number):number=>{
    const id=nodeCount++,k=id*4;
    let loX=Infinity,loY=Infinity,hiX=-Infinity,hiY=-Infinity;
    for(let j=start;j<end;j++){
      const s=order[j]!*4;
      loX=Math.min(loX,segments[s]!,segments[s+2]!);loY=Math.min(loY,segments[s+1]!,segments[s+3]!);
      hiX=Math.max(hiX,segments[s]!,segments[s+2]!);hiY=Math.max(hiY,segments[s+1]!,segments[s+3]!);
    }
    bounds.set([loX,loY,hiX,hiY],k);
    if(end-start<=8){nodes.set([-1,-1,start,end],k);return id;}
    const axis=hiX-loX>=hiY-loY?0:1;
    order.subarray(start,end).sort((a,b)=>
      (segments[a*4+axis]!+segments[a*4+axis+2]!)-(segments[b*4+axis]!+segments[b*4+axis+2]!) || a-b);
    const middle=(start+end)>>>1,left=build(start,middle),right=build(middle,end);
    nodes.set([left,right,start,end],k);return id;
  };
  if(count)build(0,count);
  const stack=new Int32Array(64);
  return {
    width,height,spacing,maxX,maxY,segmentCount:count,ambiguousCells,zeroPlateauCells,refinedEdges,refinementSamples,refinementSteps:steps,
    /** Persistent typed-array payload only; excludes engine/object overhead and build temporaries. */
    bytes:segments.byteLength+order.byteLength+bounds.byteLength+nodes.byteLength+stack.byteLength,
    /** A copy for debug/export; cannot mutate the query's owned geometry. */
    segments:()=>segments.slice(),
    nearest(x:number,y:number,radius:number):ContourHit2D|null{
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>maxX||y>maxY||
         !Number.isFinite(radius)||radius<0||radius>1e9)
        throw new RangeError('Invalid or out-of-domain contour query');
      let best=radius*radius,hit:ContourHit2D|null=null,top=0;
      if(count)stack[top++]=0;
      while(top){
        const node=stack[--top]!,k=node*4;
        const dx=Math.max(bounds[k]!-x,0,x-bounds[k+2]!),dy=Math.max(bounds[k+1]!-y,0,y-bounds[k+3]!);
        if(dx*dx+dy*dy>best)continue;
        if(nodes[k]!>=0){stack[top++]=nodes[k]!;stack[top++]=nodes[k+1]!;continue;}
        for(let j=nodes[k+2]!;j<nodes[k+3]!;j++){
          const id=order[j]!,s=id*4,ax=segments[s]!,ay=segments[s+1]!,dx=segments[s+2]!-ax,dy=segments[s+3]!-ay;
          const length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length)):0;
          const px=ax+t*dx,py=ay+t*dy,d=(x-px)**2+(y-py)**2;
          if(d<best || (d===best && (!hit||id<hit.segment))){best=d;hit={distance:Math.sqrt(d),x:px,y:py,segment:id};}
        }
      }
      return hit;
    }
  };
}
