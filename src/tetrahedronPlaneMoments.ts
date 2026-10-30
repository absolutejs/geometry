type V = readonly [number, number, number];
type MutableV = [number, number, number];
const FACES = [
  [1, 2, 3],
  [0, 3, 2],
  [0, 1, 3],
  [0, 2, 1],
] as const;
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const determinant = (a: V, b: V, c: V) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) -
  a[1] * (b[0] * c[2] - b[2] * c[0]) +
  a[2] * (b[0] * c[1] - b[1] * c[0]);
const subtract = (a: V, b: V): MutableV => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
/** Integrate the part of an oriented tetrahedron satisfying
 * dot(position - planePoint, planeNormal) <= 0. Orientation is retained so
 * callers may sum signed tetrahedral contributions of a closed solid.
 * First moments are relative to the returned reference, not world zero.
 * Does not validate a caller's solid decomposition, apply fluid forces or
 * assume a watertight cavity. No engine, mesh cap or native allocation. */
export function tetrahedronPlaneMoments(
  vertices: readonly V[],
  planePoint: V,
  planeNormal: V,
) {
  if (
    vertices.length !== 4 ||
    ![...vertices, planePoint, planeNormal].every(
      (v) => v.length === 3 && v.every(Number.isFinite),
    )
  )
    throw Error("Invalid tetrahedron plane input");
  const maximum = Math.max(...planeNormal.map(Math.abs));
  if (!(maximum > 0)) throw Error("Zero clipping normal");
  const scaledNormal = planeNormal.map((v) => v / maximum),
    length = Math.hypot(...scaledNormal);
  const n = scaledNormal.map((v) => v / length) as MutableV;
  const minimum = [0, 1, 2].map((k) => Math.min(...vertices.map((v) => v[k]!))),
    maximums = [0, 1, 2].map((k) => Math.max(...vertices.map((v) => v[k]!)));
  const extents = maximums.map((v, k) => v - minimum[k]!),
    scale = Math.max(...extents);
  if (!(scale > 0) || !Number.isFinite(scale))
    throw Error("Unrepresentable tetrahedron extent");
  const reference = minimum.map((v, k) => v + extents[k]! * 0.5) as MutableV;
  const points = vertices.map(
    (v) => subtract(v, reference).map((x) => x / scale) as MutableV,
  );
  const full =
    determinant(
      subtract(points[1]!, points[0]!),
      subtract(points[2]!, points[0]!),
      subtract(points[3]!, points[0]!),
    ) / 6;
  if (!Number.isFinite(full) || full === 0)
    throw Error("Degenerate tetrahedron");
  const fullCenter = [0, 1, 2].map(
    (k) => points.reduce((sum, p) => sum + p[k]!, 0) / 4,
  ) as MutableV;
  const planeDistance = dot(subtract(reference, planePoint), n) / scale;
  if (!Number.isFinite(planeDistance))
    throw Error("Unrepresentable clipping plane");
  const distances = vertices.map(
    (p) => dot(subtract(p, planePoint), n) / scale,
  );
  if (!distances.every(Number.isFinite))
    throw Error("Unrepresentable clipping distances");
  const finish = (
    volume: number,
    center: MutableV | null,
    worldCenter?: MutableV,
  ) => {
    const signedVolume = volume * scale * scale * scale,
      fullSignedVolume = full * scale * scale * scale;
    const firstMoment: MutableV = center
      ? (center.map((v) => signedVolume * (v * scale)) as MutableV)
      : [0, 0, 0];
    const centroid: MutableV | null =
      worldCenter ??
      (center
        ? (center.map((v, k) => reference[k]! + v * scale) as MutableV)
        : null);
    if (
      ![
        signedVolume,
        fullSignedVolume,
        ...firstMoment,
        ...(centroid ?? []),
      ].every(Number.isFinite) ||
      fullSignedVolume === 0 ||
      (volume !== 0 && signedVolume === 0) ||
      (signedVolume !== 0 &&
        center?.some((v, i) => v !== 0 && firstMoment[i] === 0))
    )
      throw Error("Unrepresentable tetrahedron moments");
    const fraction = volume / full;
    if (fraction < 0 || fraction > 1 + 1e-12)
      throw Error("Clipped tetrahedron has inconsistent orientation or volume");
    return {
      signedVolume,
      fullSignedVolume,
      fraction,
      centroid,
      firstMoment,
      reference: [...reference] as MutableV,
    };
  };
  if (distances.every((d) => d <= 0)) return finish(full, fullCenter);
  if (distances.every((d) => d >= 0)) return finish(0, null);
  // Cache each crossed edge in original coordinates. In particular, do not
  // subtract a body-sized midpoint before constructing a very small wet tip.
  const crossings = new Map<number, MutableV>();
  const intersection = (ia: number, ib: number) => {
    const lo = Math.min(ia, ib),
      hi = Math.max(ia, ib),
      key = lo * 4 + hi;
    let value = crossings.get(key);
    if (value) return value;
    const near = Math.abs(distances[lo]!) <= Math.abs(distances[hi]!) ? lo : hi,
      far = near === lo ? hi : lo;
    const a = vertices[near]!,
      b = vertices[far]!,
      t = distances[near]! / (distances[near]! - distances[far]!);
    value = a.map((v, k) => v + t * (b[k]! - v)) as MutableV;
    crossings.set(key, value);
    return value;
  };
  let anchor: V | undefined;
  for (let i = 0; i < 4 && !anchor; i++)
    if (distances[i] === 0) anchor = vertices[i]!;
  for (let i = 0; i < 4 && !anchor; i++)
    for (let j = i + 1; j < 4 && !anchor; j++)
      if (
        (distances[i]! < 0 && distances[j]! > 0) ||
        (distances[i]! > 0 && distances[j]! < 0)
      )
        anchor = intersection(i, j);
  if (!anchor) throw Error("Clipping plane has no representable crossing");
  // This actual shared cut vertex lies on the cap: omitted cap triangles
  // contribute zero signed volume and first moment relative to it.
  let volume = 0;
  const moments: MutableV = [0, 0, 0];
  for (const face of FACES) {
    const polygon: V[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const ia = face[edge]!,
        ib = face[(edge + 1) % 3]!,
        da = distances[ia]!,
        db = distances[ib]!;
      if (da <= 0) polygon.push(vertices[ia]!);
      if ((da < 0 && db > 0) || (da > 0 && db < 0))
        polygon.push(intersection(ia, ib));
    }
    for (let i = 1; i + 1 < polygon.length; i++) {
      const [a, b, c] = [polygon[0]!, polygon[i]!, polygon[i + 1]!].map(
        (v) => subtract(v, anchor!).map((x) => x / scale) as MutableV,
      ) as [MutableV, MutableV, MutableV];
      const dv = determinant(a, b, c) / 6;
      volume += dv;
      for (let k = 0; k < 3; k++)
        moments[k]! += (dv * (a[k]! + b[k]! + c[k]!)) / 4;
    }
  }
  if (volume === 0) throw Error("Clipped tetrahedron lost a nonempty volume");
  const centroid = moments.map(
    (v, k) => anchor![k]! + (v / volume) * scale,
  ) as MutableV;
  return finish(
    volume,
    subtract(centroid, reference).map((v) => v / scale) as MutableV,
    centroid,
  );
}
