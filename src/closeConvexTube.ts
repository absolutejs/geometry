/** Close one authored, open-ended tube. UV seams are welded only for topology.
 * Requires exactly two planar convex boundary rings and consistently oriented edges.
 * Boundary fans introduce no new vertices. Inputs are bounded local geometry:
 * absolute coordinates <=1000, seam weld grid 1e-6, plane residual <=1e-5.
 * Not a general hole repair, Boolean union, or arbitrary fracture triangulator. */
export type ClosedConvexTube = {
  positions: Float64Array;
  indices: Uint32Array;
  caps: Float32Array;
  capPoints: Float32Array;
  rings: number;
};
export function closeConvexTube(
  input: ArrayLike<number>,
  triangles: ArrayLike<number>,
): ClosedConvexTube {
  if (
    !input.length ||
    input.length % 3 ||
    input.length > 300000 ||
    !triangles.length ||
    triangles.length % 3 ||
    triangles.length > 600000
  )
    throw Error("Invalid tube buffers");
  const positions: number[] = [],
    remap: number[] = [],
    weld = new Map<string, number>();
  for (let i = 0; i < input.length; i += 3) {
    const p = [input[i]!, input[i + 1]!, input[i + 2]!];
    if (!p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000))
      throw Error("Invalid tube vertex");
    const key = p.map((v) => Math.round(v * 1e6)).join(",");
    let id = weld.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      weld.set(key, id);
      positions.push(...p);
    }
    remap.push(id);
  }
  const indices: number[] = [],
    edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < triangles.length; i += 3) {
    const face = [0, 1, 2].map((k) => {
      const index = triangles[i + k]!;
      if (!Number.isInteger(index) || index < 0 || index >= remap.length)
        throw Error("Invalid tube index");
      return remap[index]!;
    });
    if (new Set(face).size !== 3) throw Error("Degenerate tube triangle");
    indices.push(...face);
    for (let j = 0; j < 3; j++) {
      const a = face[j]!,
        b = face[(j + 1) % 3]!,
        key = a < b ? `${a},${b}` : `${b},${a}`;
      const edge = edges.get(key);
      if (!edge) edges.set(key, { a, b, count: 1 });
      else {
        if (edge.count !== 1 || edge.a !== b || edge.b !== a)
          throw Error("Nonmanifold or inconsistent tube winding");
        edge.count++;
      }
    }
  }
  const boundary = new Map<number, number>(),
    incoming = new Set<number>();
  for (const edge of edges.values())
    if (edge.count === 1) {
      if (boundary.has(edge.a) || incoming.has(edge.b))
        throw Error("Branched tube boundary");
      boundary.set(edge.a, edge.b);
      incoming.add(edge.b);
    }
  const caps: number[] = [],
    capPoints: number[] = [];
  let rings = 0;
  while (boundary.size) {
    if (++rings > 2) throw Error("Expected two tube boundaries");
    const start = boundary.keys().next().value!,
      ring: number[] = [];
    let at = start;
    do {
      ring.push(at);
      const next = boundary.get(at);
      if (next === undefined || ring.length > 64)
        throw Error("Open or oversized tube boundary");
      boundary.delete(at);
      at = next;
    } while (at !== start);
    if (ring.length < 3) throw Error("Degenerate tube boundary");
    const point = (id: number) => positions.slice(id * 3, id * 3 + 3);
    const center = [0, 0, 0],
      normal = [0, 0, 0];
    for (let i = 0; i < ring.length; i++) {
      const a = point(ring[i]!),
        b = point(ring[(i + 1) % ring.length]!);
      for (let k = 0; k < 3; k++) center[k]! += a[k]! / ring.length;
      normal[0]! += (a[1]! - b[1]!) * (a[2]! + b[2]!);
      normal[1]! += (a[2]! - b[2]!) * (a[0]! + b[0]!);
      normal[2]! += (a[0]! - b[0]!) * (a[1]! + b[1]!);
    }
    const magnitude = Math.hypot(...normal);
    if (magnitude < 1e-12) throw Error("Degenerate cap plane");
    for (let k = 0; k < 3; k++) normal[k]! /= magnitude;
    for (let i = 0; i < ring.length; i++) {
      const a = point(ring[i]!),
        b = point(ring[(i + 1) % ring.length]!),
        c = point(ring[(i + 2) % ring.length]!);
      if (
        Math.abs(
          a.reduce((sum, v, k) => sum + (v - center[k]!) * normal[k]!, 0),
        ) > 1e-5
      )
        throw Error("Nonplanar tube boundary");
      const u = b.map((v, k) => v - a[k]!),
        v = c.map((v, k) => v - b[k]!);
      const turn =
        (u[1]! * v[2]! - u[2]! * v[1]!) * normal[0]! +
        (u[2]! * v[0]! - u[0]! * v[2]!) * normal[1]! +
        (u[0]! * v[1]! - u[1]! * v[0]!) * normal[2]!;
      if (turn <= 0) throw Error("Nonconvex tube boundary");
      // Local turns alone also accept a star polygon. Every ring vertex must
      // lie in the same closed half-plane of every directed edge.
      for (const id of ring) {
        const w = point(id).map((value, k) => value - a[k]!);
        const side =
          (u[1]! * w[2]! - u[2]! * w[1]!) * normal[0]! +
          (u[2]! * w[0]! - u[0]! * w[2]!) * normal[1]! +
          (u[0]! * w[1]! - u[1]! * w[0]!) * normal[2]!;
        if (side < -1e-12)
          throw Error("Self-intersecting or nonconvex tube boundary");
      }
    }
    const axis = point(ring[0]!).map((v, k) => v - center[k]!);
    const axisLength = Math.hypot(...axis);
    for (let k = 0; k < 3; k++) axis[k]! /= axisLength;
    const across = [
      normal[1]! * axis[2]! - normal[2]! * axis[1]!,
      normal[2]! * axis[0]! - normal[0]! * axis[2]!,
      normal[0]! * axis[1]! - normal[1]! * axis[0]!,
    ];
    const uv = (id: number) => {
      const p = point(id).map((v, k) => v - center[k]!);
      return [
        p.reduce((sum, v, k) => sum + v * axis[k]!, 0),
        p.reduce((sum, v, k) => sum + v * across[k]!, 0),
      ];
    };
    // Convex boundary fan uses only authored vertices. Introducing an averaged
    // centre creates nearly coincident cap vertices at limb junctions and
    // unstable Boolean slivers. UVs still use the ring's geometric centre.
    const anchor = ring[0]!;
    for (let i = 1; i < ring.length - 1; i++) {
      const a = ring[i]!,
        b = ring[i + 1]!;
      indices.push(b, a, anchor);
      caps.push(...point(b), ...point(a), ...point(anchor));
      capPoints.push(...uv(b), ...uv(a), ...uv(anchor));
    }
  }
  if (rings !== 2) throw Error("Expected two tube boundaries");
  return {
    positions: Float64Array.from(positions),
    indices: Uint32Array.from(indices),
    caps: Float32Array.from(caps),
    capPoints: Float32Array.from(capPoints),
    rings,
  };
}
