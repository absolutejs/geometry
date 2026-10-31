type V = readonly [number, number, number];
type M = [number, number, number];
const sub = (a: V, b: V): M => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Owned, immutable triangle preparation. Queries retain dot(x-point,normal)<=0.
 * Area is unsigned; surfaceNormal preserves source winding. First and row-major
 * second area moments are relative to the returned reference, not world zero.
 * No mesh topology, fluid exposure, pressure coefficient or force is inferred. */
export function prepareTrianglePlaneMoments(input: readonly V[]) {
  if (
    input.length !== 3 ||
    !input.every((v) => v.length === 3 && v.every(Number.isFinite))
  )
    throw Error("Invalid triangle plane input");
  const vertices = input.map((v) => [...v] as M);
  const u = sub(vertices[1]!, vertices[0]!),
    v = sub(vertices[2]!, vertices[0]!);
  const scale = Math.max(...u.map(Math.abs), ...v.map(Math.abs));
  if (!(scale > 0) || !Number.isFinite(scale))
    throw Error("Unrepresentable triangle extent");
  const a = u.map((x) => x / scale) as M,
    b = v.map((x) => x / scale) as M;
  const cross: M = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const length = Math.hypot(...cross);
  if (!(length > 0) || !Number.isFinite(length))
    throw Error("Degenerate triangle");
  const surfaceNormal = cross.map((x) => x / length) as M,
    full = length / 2;
  const fullArea = full * scale * scale;
  if (!(fullArea > 0) || !Number.isFinite(fullArea))
    throw Error("Unrepresentable triangle area");
  function integrate(area: number, points: readonly V[]) {
    const sum = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k]!, 0));
    const first = sum.map((x) => (area * x) / 3);
    const second = Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(i / 3),
        c = i % 3;
      return (
        (area *
          (sum[r]! * sum[c]! + points.reduce((s, p) => s + p[r]! * p[c]!, 0))) /
        12
      );
    });
    return { area, first, second };
  }
  const fullMoments = integrate(full, [[0, 0, 0], a, b]);
  const pack = (moments: ReturnType<typeof integrate>, reference: V) => {
    const area = moments.area * scale * scale;
    const firstMoment = moments.first.map(
      (x) => x * scale * scale * scale,
    ) as M;
    const secondMoment = moments.second.map(
      (x) => x * scale * scale * scale * scale,
    );
    const centroid =
      area > 0
        ? (moments.first.map(
            (x, k) => reference[k]! + (x / moments.area) * scale,
          ) as M)
        : null;
    if (
      ![area, ...firstMoment, ...secondMoment, ...(centroid ?? [])].every(
        Number.isFinite,
      ) ||
      (moments.area !== 0 && area === 0) ||
      moments.first.some((x, i) => x !== 0 && firstMoment[i] === 0) ||
      moments.second.some((x, i) => x !== 0 && secondMoment[i] === 0)
    )
      throw Error("Unrepresentable triangle moments");
    const fraction = moments.area / full;
    if (fraction < 0 || fraction > 1 + 1e-12)
      throw Error("Clipped triangle area is inconsistent");
    return {
      area,
      fullArea,
      fraction,
      centroid,
      firstMoment,
      secondMoment,
      reference: [...reference] as M,
      surfaceNormal: [...surfaceNormal] as M,
    };
  };
  return (point: V, normal: V) => {
    if (
      ![point, normal].every((v) => v.length === 3 && v.every(Number.isFinite))
    )
      throw Error("Invalid triangle plane input");
    const maximum = Math.max(...normal.map(Math.abs));
    if (!(maximum > 0)) throw Error("Zero clipping normal");
    const n = normal.map((x) => x / maximum) as M;
    const distances = vertices.map((v) => dot(sub(v, point), n) / scale);
    if (!distances.every(Number.isFinite))
      throw Error("Unrepresentable clipping distances");
    if (distances.every((d) => d <= 0)) return pack(fullMoments, vertices[0]!);
    if (distances.every((d) => d >= 0))
      return pack(
        { area: 0, first: [0, 0, 0], second: Array(9).fill(0) },
        vertices[0]!,
      );
    const wet = distances.map((d, i) => (d < 0 ? i : -1)).filter((i) => i >= 0);
    const ia = wet[0]!,
      reference = vertices[ia]!;
    const relative = vertices.map(
      (v) => sub(v, reference).map((x) => x / scale) as M,
    );
    const edge = (inside: number, outside: number) => {
      const denominator = distances[inside]! - distances[outside]!;
      const insideFraction = distances[inside]! / denominator,
        outsideFraction = -distances[outside]! / denominator;
      const near =
        Math.abs(distances[inside]!) <= Math.abs(distances[outside]!)
          ? inside
          : outside;
      const far = near === inside ? outside : inside,
        t = near === inside ? insideFraction : outsideFraction;
      const position = relative[near]!.map(
        (x, k) => x + t * (relative[far]![k]! - x),
      ) as M;
      return { position, insideFraction, outsideFraction };
    };
    if (wet.length === 1) {
      const other = [0, 1, 2].filter((i) => i !== ia),
        e1 = edge(ia, other[0]!),
        e2 = edge(ia, other[1]!);
      const area = full * e1.insideFraction * e2.insideFraction;
      if (area === 0) throw Error("Unrepresentable nonempty clipped triangle");
      return pack(
        integrate(area, [[0, 0, 0], e1.position, e2.position]),
        reference,
      );
    }
    const ib = wet[1]!,
      ic = [0, 1, 2].find((i) => i !== ia && i !== ib)!;
    const ea = edge(ia, ic),
      eb = edge(ib, ic);
    // Two positive subtriangle areas avoid subtracting a nearly full dry corner.
    const area1 = full * eb.insideFraction,
      area2 = full * ea.insideFraction * eb.outsideFraction;
    if (area1 === 0 || area2 === 0)
      throw Error("Unrepresentable nonempty clipped triangle");
    const first = integrate(area1, [[0, 0, 0], relative[ib]!, eb.position]);
    const second = integrate(area2, [[0, 0, 0], eb.position, ea.position]);
    return pack(
      {
        area: first.area + second.area,
        first: first.first.map((x, i) => x + second.first[i]!),
        second: first.second.map((x, i) => x + second.second[i]!),
      },
      reference,
    );
  };
}
export function trianglePlaneMoments(
  vertices: readonly V[],
  point: V,
  normal: V,
) {
  return prepareTrianglePlaneMoments(vertices)(point, normal);
}
