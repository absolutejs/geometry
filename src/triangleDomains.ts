export type DomainBox = {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
};
type Point = readonly [number, number, number];
type Vertex = { p: number[]; w: number[] };
export type TriangleDomainCell = {
  /** Convex polygon, in original triangle winding; fan triangulation is valid. */
  /** Shared input-triangle origin, copied into this cell. */
  reference: Float64Array;
  /** Coordinates relative to reference; do not discard this origin. */
  relativePositions: Float64Array;
  /** Barycentric coordinates in the input triangle, one triple per vertex. */
  barycentric: Float64Array;
  /** Input domain/box indices containing this polygon's relative interior. */
  domains: Uint32Array;
};
/** Partition a triangle by domains of affine fields (three vertex values each).
 * A domain is the intersection where all its fields are nonnegative. This classifies domains, NOT
 * solid material ownership. A caller must establish its own source-union premise.
 * Touching lines/points do not produce separate zero-area cells. A triangle
 * coplanar with a box boundary belongs to that box. No epsilon or snapping is used.
 * Work and output are bounded; budget/representability failures throw, never return
 * a partial partition. Input buffers are never borrowed in the result. */
export function partitionTriangleAffineDomains(
  triangle: readonly [Point, Point, Point],
  domains: readonly (readonly Point[])[],
  options: { maxCells?: number; maxVertices?: number } = {},
): TriangleDomainCell[] {
  const maxCells = options.maxCells ?? 1024;
  const maxVertices = options.maxVertices ?? 8192;
  if (
    !Number.isSafeInteger(maxCells) ||
    maxCells < 1 ||
    maxCells > 16384 ||
    !Number.isSafeInteger(maxVertices) ||
    maxVertices < 3 ||
    maxVertices > 131072 ||
    !Array.isArray(triangle) ||
    triangle.length !== 3 ||
    !Array.isArray(domains) ||
    domains.length > 64
  )
    throw Error("Invalid triangle domain budget");
  const valid = (p: readonly number[]) =>
    Array.isArray(p) &&
    p.length === 3 &&
    p.every((x) => Number.isFinite(x) && Math.abs(x) <= 1e100);
  if (
    !triangle.every(valid) ||
    !domains.every(
      (d) =>
        Array.isArray(d) && d.length > 0 && d.length <= 32 && d.every(valid),
    )
  )
    throw Error("Invalid triangle domain coordinates or affine fields");
  const origin = triangle[0];
  const initial = triangle.map((p, i) => ({
    p: p.map((v, a) => v - origin[a]!),
    w: [+(i === 0), +(i === 1), +(i === 2)],
  }));
  const magnitude = (v: Vertex[]) => {
    let area = 0;
    for (let i = 1; i + 1 < v.length; i++) {
      const u = v[i]!.p.map((x, a) => x - v[0]!.p[a]!),
        w = v[i + 1]!.p.map((x, a) => x - v[0]!.p[a]!);
      area +=
        Math.hypot(
          u[1]! * w[2]! - u[2]! * w[1]!,
          u[2]! * w[0]! - u[0]! * w[2]!,
          u[0]! * w[1]! - u[1]! * w[0]!,
        ) / 2;
    }
    return area;
  };
  const originalArea = magnitude(initial);
  if (!(originalArea > 0) || !Number.isFinite(originalArea))
    throw Error("Unrepresentable triangle domain area");
  // Each split creates two polygons sharing the same computed crossing vertices.
  const split = (polygon: Vertex[], field: Point): [Vertex[], Vertex[]] => {
    const d = polygon.map(
      (v) => v.w[0]! * field[0] + v.w[1]! * field[1] + v.w[2]! * field[2],
    );
    if (d.every((x) => x >= 0)) return [polygon, []];
    if (d.every((x) => x <= 0)) return [[], polygon];
    const inside: Vertex[] = [],
      outside: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length,
        a = polygon[i]!,
        b = polygon[j]!,
        da = d[i]!,
        db = d[j]!;
      if (da >= 0) inside.push(a);
      if (da <= 0) outside.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
        // Interpolate from the closer endpoint to preserve thin fragments.
        const near = Math.abs(da) <= Math.abs(db) ? a : b,
          far = near === a ? b : a;
        const t =
          Math.min(Math.abs(da), Math.abs(db)) / (Math.abs(da) + Math.abs(db));
        if (!(t > 0 && t < 1))
          throw Error("Unrepresentable domain intersection fraction");
        const v = {
          p: near.p.map((x, k) => x + (far.p[k]! - x) * t),
          w: near.w.map((x, k) => x + (far.w[k]! - x) * t),
        };
        if (!v.p.every(Number.isFinite) || !v.w.every(Number.isFinite))
          throw Error("Unrepresentable domain intersection");
        inside.push(v);
        outside.push(v);
      }
    }
    return [inside, outside];
  };
  let cells: { vertices: Vertex[]; boxes: number[] }[] = [
    { vertices: initial, boxes: [] },
  ];
  for (const [id, domain] of domains.entries()) {
    const next: typeof cells = [];
    let vertices = 0;
    const append = (v: Vertex[], owners: number[]) => {
      if (v.length < 3 || magnitude(v) === 0) return;
      vertices += v.length;
      if (next.length >= maxCells || vertices > maxVertices)
        throw Error("Triangle domain partition budget exceeded");
      next.push({ vertices: v, boxes: owners });
    };
    for (const cell of cells) {
      const disjoint = domain.some((field: Point) =>
        cell.vertices.every(
          (v) =>
            v.w[0]! * field[0] + v.w[1]! * field[1] + v.w[2]! * field[2] < 0,
        ),
      );
      if (disjoint) {
        append(cell.vertices, cell.boxes);
        continue;
      }
      let inside = cell.vertices;
      for (const field of domain) {
        if (!inside.length) break;
        const [keep, out] = split(inside, field);
        append(out, cell.boxes);
        inside = keep;
      }
      append(inside, [...cell.boxes, id]);
    }
    cells = next;
  }
  const area = cells.reduce((sum, c) => sum + magnitude(c.vertices), 0);
  if (!Number.isFinite(area) || Math.abs(area / originalArea - 1) > 1e-10)
    throw Error("Triangle domain area conservation failed");
  return cells.map((c) => ({
    reference: Float64Array.from(origin),
    relativePositions: Float64Array.from(c.vertices.flatMap((v) => v.p)),
    barycentric: Float64Array.from(c.vertices.flatMap((v) => v.w)),
    domains: Uint32Array.from(c.boxes),
  }));
}

/** Convenience adapter: each AABB contributes six affine half-spaces. */
export function partitionTriangleBoxDomains(
  triangle: readonly [Point, Point, Point],
  boxes: readonly DomainBox[],
  options: { maxCells?: number; maxVertices?: number } = {},
): TriangleDomainCell[] {
  if (
    !Array.isArray(triangle) ||
    triangle.length !== 3 ||
    !triangle.every(
      (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite),
    ) ||
    !Array.isArray(boxes) ||
    boxes.length > 64 ||
    !boxes.every(
      (b) =>
        b &&
        Array.isArray(b.min) &&
        Array.isArray(b.max) &&
        b.min.length === 3 &&
        b.max.length === 3 &&
        b.min.every(
          (v: number, a: number) =>
            Number.isFinite(v) && Number.isFinite(b.max[a]) && v <= b.max[a]!,
        ),
    )
  )
    throw Error("Invalid triangle boxes");
  const domains = boxes.map((b) =>
    [0, 1, 2].flatMap((a) => [
      triangle.map((p) => p[a]! - b.min[a]!) as unknown as Point,
      triangle.map((p) => b.max[a]! - p[a]!) as unknown as Point,
    ]),
  );
  return partitionTriangleAffineDomains(triangle, domains, options);
}
