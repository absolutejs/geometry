import { prepareTriangleFirstPlaneMomentsForSolid } from "./trianglePlaneMoments.js";
import { solidComponents } from "./solidComponents.js";
import { signedVolume } from "./signedVolume.js";
import { prepareTetrahedronPlaneMoments } from "./tetrahedronPlaneMoments.js";
type V = readonly [number, number, number];
type M = [number, number, number];
/** Repeated plane cuts of an unchanged, valid exclusive oriented material mesh.
 * Explicit owners retain cavity identity. This checks closed components, not
 * intersections between distinct owners. It does not infer fluid exposure or air.
 * Queries keep dot(x-point,normal)<=0 and return moments about `reference`.
 */
export function prepareSolidPlaneMoments(input: {
  positions: Float64Array;
  indices: Uint32Array;
  owners: Int16Array | Uint16Array;
}) {
  if (
    !(input.positions instanceof Float64Array) ||
    input.positions.length < 12 ||
    input.positions.length > 300000 ||
    input.positions.length % 3 ||
    !input.positions.every(Number.isFinite) ||
    !(input.indices instanceof Uint32Array) ||
    input.indices.length < 12 ||
    input.indices.length > 600000 ||
    input.indices.length % 3
  )
    throw Error("Invalid solid plane mesh");
  const reference = Array.from(input.positions.slice(0, 3)) as M;
  const positions = Float64Array.from(
    input.positions,
    (v, i) => v - reference[i % 3]!,
  );
  if (!positions.every(Number.isFinite))
    throw Error("Unrepresentable solid plane extent");
  const partition = solidComponents(positions, input.indices, input.owners);
  if (!partition.components.length || partition.components.length > 128)
    throw Error("Solid plane component budget exceeded");
  let skippedDegenerateTetrahedra = 0;
  const groups = partition.components.map((c) => {
    const low: M = [Infinity, Infinity, Infinity],
      high: M = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < c.positions.length; i++) {
      const k = i % 3;
      low[k] = Math.min(low[k]!, c.positions[i]!);
      high[k] = Math.max(high[k]!, c.positions[i]!);
    }
    const extent = Math.max(...high.map((x, k) => x - low[k]!));
    if (!(extent > 0) || !Number.isFinite(extent))
      throw Error("Unrepresentable solid plane extent");
    const apex = low.map((x, k) => x - extent * (1.234 + k * 0.271)) as M;
    const fullPoint: M = [0, high[1] + extent, 0];
    const surfaceQueries = [];
    let volume = 0;
    const moment: M = [0, 0, 0];
    for (let t = 0; t < c.indices.length; t += 3) {
      const vertices = [
        apex,
        ...[0, 1, 2].map((k) => {
          const i = c.indices[t + k]! * 3;
          return [
            c.positions[i]!,
            c.positions[i + 1]!,
            c.positions[i + 2]!,
          ] as M;
        }),
      ];
      surfaceQueries.push(prepareTriangleFirstPlaneMomentsForSolid(vertices.slice(1)));
      let query: ReturnType<typeof prepareTetrahedronPlaneMoments>;
      try {
        query = prepareTetrahedronPlaneMoments(vertices);
      } catch (e) {
        if (e instanceof Error && e.message === "Degenerate tetrahedron") {
          skippedDegenerateTetrahedra++;
          continue;
        }
        throw e;
      }
      const full = query(fullPoint, [0, 1, 0]);
      volume += full.signedVolume;
      for (let k = 0; k < 3; k++)
        moment[k]! += full.signedVolume * full.centroid![k]!;
    }
    const expected = signedVolume(c.positions, c.indices);
    if (
      !(volume > 0) ||
      ![volume, ...moment].every(Number.isFinite) ||
      Math.abs(volume / expected - 1) > 1e-9
    )
      throw Error("Solid plane full moments disagree");
    return { low, high, extent, surfaceQueries, volume, moment };
  });
  const fullVolume = groups.reduce((s, g) => s + g.volume, 0);
  if (!Number.isFinite(fullVolume)) throw Error("Unrepresentable solid volume");
  return (point: V, normal: V) => {
    if (
      ![point, normal].every((v) => v.length === 3 && v.every(Number.isFinite))
    )
      throw Error("Invalid solid clipping plane");
    const max = Math.max(...normal.map(Math.abs));
    if (!(max > 0)) throw Error("Zero clipping normal");
    const n = normal.map((x) => x / max) as M,
      p = point.map((x, k) => x - reference[k]!) as M;
    if (!p.every(Number.isFinite))
      throw Error("Unrepresentable clipping plane");
    let volume = 0,
      fullComponents = 0,
      dryComponents = 0,
      partialComponents = 0,
      clippedTetrahedra = 0,
      evaluatedSurfaceTriangles = 0;
    const firstMoment: M = [0, 0, 0];
    for (const g of groups) {
      let near = 0,
        far = 0,
        scale = 0;
      for (let k = 0; k < 3; k++) {
        const a = (g.low[k]! - p[k]!) * n[k]!,
          b = (g.high[k]! - p[k]!) * n[k]!;
        near += Math.min(a, b);
        far += Math.max(a, b);
        scale +=
          (Math.abs(g.low[k]!) + Math.abs(g.high[k]!) + 2 * Math.abs(p[k]!)) *
          Math.abs(n[k]!);
      }
      if (![near, far, scale].every(Number.isFinite))
        throw Error("Unrepresentable plane interval");
      const margin = 64 * Number.EPSILON * Math.max(scale, g.extent);
      if (near > margin) {
        dryComponents++;
        continue;
      }
      if (far < -margin) {
        fullComponents++;
        volume += g.volume;
        for (let k = 0; k < 3; k++) firstMoment[k]! += g.moment[k]!;
        continue;
      }
      partialComponents++;
      // The cap lies in the clipping plane, so its flux about a point on that
      // plane is zero. div(y)=3 and div(y_i*y)=4*y_i give the moments.
      const center = g.low.map((v, k) => (v + g.high[k]!) * 0.5) as M;
      const offset =
        center.reduce((sum, v, k) => sum + (v - p[k]!) * n[k]!, 0) /
        n.reduce((sum, v) => sum + v * v, 0);
      const origin = center.map((v, k) => v - offset * n[k]!) as M;
      // Reanchor the dominant coordinate to the input plane: subtracting a
      // nearly equal projection from the center can erase thin wet depths.
      const dominant = n.findIndex((x) => Math.abs(x) === 1);
      let tangent = 0;
      for (let k = 0; k < 3; k++)
        if (k !== dominant) tangent += (origin[k]! - p[k]!) * n[k]!;
      origin[dominant] = p[dominant]! - tangent / n[dominant]!;
      for (const query of g.surfaceQueries) {
        const r = query(p, n);
        evaluatedSurfaceTriangles++;
        const dx=r.reference[0]-origin[0],dy=r.reference[1]-origin[1],dz=r.reference[2]-origin[2];
        const distance=dx*r.surfaceNormal[0]+dy*r.surfaceNormal[1]+dz*r.surfaceNormal[2];
        const v=(distance*r.area)/3;
        volume+=v;
        firstMoment[0]+=origin[0]*v+(distance*(r.firstMoment[0]+dx*r.area))/4;
        firstMoment[1]+=origin[1]*v+(distance*(r.firstMoment[1]+dy*r.area))/4;
        firstMoment[2]+=origin[2]*v+(distance*(r.firstMoment[2]+dz*r.area))/4;
      }
    }
    const fraction = volume / fullVolume;
    if (
      ![volume, ...firstMoment, fraction].every(Number.isFinite) ||
      fraction < -1e-10 ||
      fraction > 1 + 1e-10
    )
      throw Error("Clipped solid moments are inconsistent");
    const centroid =
      volume > 0
        ? (firstMoment.map((x, k) => reference[k]! + x / volume) as M)
        : null;
    if (centroid && !centroid.every(Number.isFinite))
      throw Error("Unrepresentable solid centroid");
    return {
      volume,
      fullVolume,
      fraction,
      firstMoment,
      reference: [...reference] as M,
      centroid,
      stats: {
        components: groups.length,
        cavities: partition.cavities,
        fullComponents,
        dryComponents,
        partialComponents,
        clippedTetrahedra,
        evaluatedSurfaceTriangles,
        skippedDegenerateTetrahedra,
      },
    };
  };
}
