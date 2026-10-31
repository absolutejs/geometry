"""Exact rational oracle over binary64 inputs; no production geometry imports."""
import json, itertools
from fractions import Fraction as F
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=json.loads((root/'tests/fixtures/cut-body-plane.json').read_text())['vertices']
def det(a,b,c):
 return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0])
rows=[]
for scale,offset,reach in [(1,0,1),(1e-6,0,1),(1e6,0,1),(1e-60,0,1),(1e60,0,1),(1,1e4,1),(1,0,100),(1,0,1e6)]:
 for order in itertools.permutations(range(4)):
  vertices=[[((x*reach if i==0 else x)+offset)*scale for x in source[i]] for i in order]
  point=[offset*scale]*3
  v=[[F(x) for x in a] for a in vertices]
  volume=det(*[[v[i][k]-v[0][k] for k in range(3)] for i in [1,2,3]])/6
  distances=[a[1]-F(point[1]) for a in v]
  outside=next(i for i,d in enumerate(distances) if d>0)
  ratio=F(1);corners=[v[outside]]
  for i in range(4):
   if i==outside:continue
   t=distances[outside]/(distances[outside]-distances[i]);ratio*=t
   corners.append([v[outside][k]+t*(v[i][k]-v[outside][k]) for k in range(3)])
  wet=volume*(1-ratio)
  center=[(sum(a[k] for a in v)/4-ratio*sum(a[k] for a in corners)/4)/(1-ratio) for k in range(3)]
  rows.append(dict(scale=scale,offset=offset,reach=reach,order=order,vertices=vertices,point=point,full=float(volume),wet=float(wet),centroid=list(map(float,center))))
(root/'tests/fixtures/plane-conditioning-oracle.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
print(len(rows),'exact-input cases')
# Independent oblique-plane reduction from the longer native cut-limb run.
path=root/'tests/fixtures/cut-body-oblique-plane.json'
r=json.loads(path.read_text());v=[[F(x) for x in a] for a in r['vertices']]
p=list(map(F,r['planePoint']));n=list(map(F,r['planeNormal']))
d=[sum((a[k]-p[k])*n[k] for k in range(3)) for a in v]
full=det(*[[v[i][k]-v[0][k] for k in range(3)] for i in [1,2,3]])/6
outside=next(i for i,x in enumerate(d) if x>0);ratio=F(1);corners=[v[outside]]
for i in range(4):
 if i==outside:continue
 t=d[outside]/(d[outside]-d[i]);ratio*=t
 corners.append([v[outside][k]+t*(v[i][k]-v[outside][k]) for k in range(3)])
center=[(sum(a[k] for a in v)/4-ratio*sum(a[k] for a in corners)/4)/(1-ratio) for k in range(3)]
r['oracle']={'full':float(full),'wet':float(full*(1-ratio)),'centroid':list(map(float,center))}
path.write_text(json.dumps(r,indent=2)+'\n')
