import { closedComponents } from './closedComponents.js';
import { solidPointMembership } from './solidPointMembership.js';

/** Material components of a valid oriented Boolean boundary, restricted by explicit
 * source identity. Input shells of each owner must not intersect or touch. This is
 * not a triangle-soup repair or intersection validator. Positive islands remain
 * separate; negative cavity walls attach to the smallest enclosing positive shell.
 * All cavity vertices are checked, with a bounded winding-query budget. */
export function solidComponents(
  positions: Float64Array,
  indices: Uint32Array,
  owners: Int16Array | Uint16Array,
  maxTriangleTests = 2_000_000,
) {
  if (!(owners instanceof Int16Array || owners instanceof Uint16Array) ||
      owners.length !== indices.length / 3 || !owners.every(v => v >= 0) ||
      !Number.isSafeInteger(maxTriangleTests) || maxTriangleTests < 1 || maxTriangleTests > 8_000_000)
    throw Error('Invalid material component input');
  const shells = closedComponents(positions, indices).map(mesh => {
    const owner = owners[mesh.sourceTriangles[0]!]!;
    if (mesh.sourceTriangles.some(t => owners[t] !== owner)) throw Error('Mixed shell ownership');
    const volume = signedVolume(mesh.positions, mesh.indices);
    if (!Number.isFinite(volume) || volume === 0) throw Error('Unresolved shell volume');
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    mesh.positions.forEach((v, i) => { const k = i % 3; min[k] = Math.min(min[k]!, v); max[k] = Math.max(max[k]!, v); });
    return { ...mesh, owner, volume, min, max };
  });
  const positive = shells.filter(s => s.volume > 0),
    holes = shells.filter(s => s.volume < 0),
    children = positive.map(() => [] as typeof shells),
    classifiers = new Map<number, ReturnType<typeof solidPointMembership>>();
  let pointQueries = 0, triangleTests = 0;
  for (const hole of holes) {
    const enclosing: number[] = [];
    for (const [id, outer] of positive.entries()) {
      if (hole.owner !== outer.owner || hole.min.some((v,k) => v < outer.min[k]! || hole.max[k]! > outer.max[k]!)) continue;
      let classify = classifiers.get(id);
      if (!classify) { classify = solidPointMembership(outer.positions, outer.indices); classifiers.set(id, classify); }
      let inside = 0, outside = 0;
      for (let v = 0; v < hole.positions.length; v += 3) {
        triangleTests += outer.indices.length / 3;
        if (triangleTests > maxTriangleTests) throw Error('Material containment budget exceeded');
        pointQueries++;
        const membership = classify([hole.positions[v]!, hole.positions[v+1]!, hole.positions[v+2]!]);
        if (membership === 'boundary') throw Error('Touching material shells');
        if (membership === 'inside') inside++; else outside++;
        if (inside && outside) throw Error('Crossing material shells');
      }
      if (inside) enclosing.push(id);
    }
    enclosing.sort((a,b) => positive[a]!.volume - positive[b]!.volume);
    if (!enclosing.length) throw Error('Cavity has no enclosing source solid');
    if (enclosing.length > 1 && positive[enclosing[0]!]!.volume === positive[enclosing[1]!]!.volume)
      throw Error('Ambiguous cavity parent');
    children[enclosing[0]!]!.push(hole);
  }
  const components = positive.map((outer,id) => {
    const parts = [outer, ...children[id]!], p: number[] = [], i: number[] = [], triangles: number[] = [];
    for (const part of parts) {
      const offset = p.length / 3;
      for (const v of part.positions) p.push(v);
      for (const v of part.indices) i.push(v + offset);
      for (const t of part.sourceTriangles) triangles.push(t);
    }
    const mesh = { positions: Float64Array.from(p), indices: Uint32Array.from(i), sourceTriangles: Uint32Array.from(triangles) };
    if (!(signedVolume(mesh.positions, mesh.indices) > 0)) throw Error('Nonpositive material component');
    return mesh;
  });
  return { components, shells: shells.length, cavities: holes.length, pointQueries, triangleTests };
}

function signedVolume(p: Float64Array, i: Uint32Array) {
  const o = i[0]! * 3, ox = p[o]!, oy = p[o+1]!, oz = p[o+2]!;
  let sum = 0, error = 0;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t]! * 3, b = i[t+1]! * 3, c = i[t+2]! * 3;
    const ax = p[a]! - ox, ay = p[a+1]! - oy, az = p[a+2]! - oz;
    const bx = p[b]! - ox, by = p[b+1]! - oy, bz = p[b+2]! - oz;
    const cx = p[c]! - ox, cy = p[c+1]! - oy, cz = p[c+2]! - oz;
    const term = (ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
    const increment = term - error, next = sum + increment;
    error = next - sum - increment; sum = next;
  }
  return sum;
}
