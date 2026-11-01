type V = readonly [number, number, number];
type M = [number, number, number];
/** Prepare an owned triangle for exact polynomial integration over the region
 * where a linearly interpolated scalar is positive. Query values are supplied
 * at its three vertices. Integrates s², (x-reference)s² and s³, without sampling
 * or native geometry. Suitable for pressure/weighted-area calculations; no
 * coefficient, exposure, force or time integrator is inferred. */
export function prepareTrianglePositiveQuadraticMoments(input: readonly V[]) {
  if (input.length !== 3 || !input.every(v=>v.length===3 && v.every(Number.isFinite)))
    throw Error('Invalid positive quadratic triangle');
  const reference=[...input[0]!] as M;
  const u=input[1]!.map((v,k)=>v-reference[k]!) as M;
  const v=input[2]!.map((x,k)=>x-reference[k]!) as M;
  const scale=Math.max(...u.map(Math.abs),...v.map(Math.abs));
  if(!(scale>0)||!Number.isFinite(scale))throw Error('Unrepresentable quadratic triangle extent');
  const a=u.map(x=>x/scale),b=v.map(x=>x/scale);
  const cross=[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!];
  const length=Math.hypot(...cross),fullArea=length*.5*scale*scale;
  if(!(fullArea>0)||!Number.isFinite(fullArea))throw Error('Degenerate or unrepresentable quadratic triangle');
  const surfaceNormal=cross.map(x=>x/length) as M;
  return (values:readonly number[])=>{
    if(values.length!==3||!values.every(Number.isFinite))throw Error('Invalid triangle scalar values');
    const k=Math.max(...values.map(Math.abs));
    let area=0,quadratic=0,cubic=0;
    const first:M=[0,0,0];
    if(k>0 && values.some(s=>s>0)) {
      type Node={p:[number,number];s:number};
      const vertices:Node[]=[{p:[0,0],s:values[0]!/k},{p:[1,0],s:values[1]!/k},{p:[0,1],s:values[2]!/k}];
      const polygon:Node[]=[];
      for(let i=0;i<3;i++){
        const left=vertices[(i+2)%3]!,right=vertices[i]!;
        if((left.s>=0)!==(right.s>=0)){
          const t=left.s/(left.s-right.s);
          polygon.push({p:[left.p[0]+(right.p[0]-left.p[0])*t,left.p[1]+(right.p[1]-left.p[1])*t],s:0});
        }
        if(right.s>=0)polygon.push(right);
      }
      for(let i=1;i+1<polygon.length;i++){
        const nodes=[polygon[0]!,polygon[i]!,polygon[i+1]!];
        const [p,q,r]=nodes.map(n=>n.p);
        const fraction=(q![0]-p![0])*(r![1]-p![1])-(q![1]-p![1])*(r![0]-p![0]);
        if(fraction<0||!Number.isFinite(fraction))throw Error('Inconsistent positive triangle orientation');
        if(fraction===0)continue;
        const pieceArea=fullArea*fraction,s=nodes.map(n=>n.s);
        const [s0,s1,s2]=s as M;
        quadratic+=pieceArea*(s0*s0+s1*s1+s2*s2+s0*s1+s1*s2+s2*s0)/6;
        cubic+=pieceArea*(s0**3+s1**3+s2**3+s0*s0*(s1+s2)+s1*s1*(s0+s2)+s2*s2*(s0+s1)+s0*s1*s2)/10;
        for(let j=0;j<3;j++){
          const x=s[j]!,y=s[(j+1)%3]!,z=s[(j+2)%3]!;
          const weight=pieceArea*(3*x*x+y*y+z*z+2*x*(y+z)+y*z)/30;
          for(let d=0;d<3;d++)first[d]!+=weight*(u[d]!*nodes[j]!.p[0]+v[d]!*nodes[j]!.p[1]);
        }
        area+=pieceArea;
      }
    }
    const integral=quadratic*k*k,cubicIntegral=cubic*k*k*k;
    const relativeFirstMoment=first.map(x=>x*k*k) as M;
    const meanOffset=quadratic>0?first.map(x=>x/quadratic) as M:null;
    if(![area,integral,cubicIntegral,...relativeFirstMoment,...(meanOffset??[])].every(Number.isFinite)||
       (quadratic>0&&integral===0)||(cubic>0&&cubicIntegral===0)||area>fullArea*(1+1e-12))
      throw Error('Unrepresentable positive quadratic moments');
    return {area,fullArea,integral,cubicIntegral,relativeFirstMoment,meanOffset,
      reference:[...reference] as M,surfaceNormal:[...surfaceNormal] as M};
  };
}
