export type UpwardSurfaceInput = {
  positions: Float32Array | Float64Array;
  indices: Uint16Array | Uint32Array;
  cellSize?: number;
  /** Hard cap on total triangle-to-cell references, not just occupied cells. */
  maxReferences?: number;
};
export type UpwardSurfaceHit = {
  height: number;
  slopeX: number;
  slopeZ: number;
  triangle: number;
};
/** Immutable, bounded XZ index for repeated vertical support queries. Only
 * upward-wound nonvertical faces participate. This is a surface query, not solid
 * membership, collision resolution or a proof of static support. Input arrays
 * are not retained; queries report their actual triangle work. */
export function prepareUpwardSurface(input: UpwardSurfaceInput) {
  const {
    positions: p,
    indices: ids,
    cellSize = 4,
    maxReferences = 262144,
  } = input;
  if (
    !(p instanceof Float32Array || p instanceof Float64Array) ||
    !(ids instanceof Uint16Array || ids instanceof Uint32Array) ||
    p.length % 3 ||
    ids.length % 3 ||
    p.length > 3 * 262144 ||
    ids.length > 3 * 131072 ||
    !Number.isFinite(cellSize) ||
    cellSize <= 0 ||
    !Number.isSafeInteger(maxReferences) ||
    maxReferences < 1 ||
    maxReferences > 1048576
  )
    throw new RangeError("Invalid upward surface input or budget");
  for (const value of p)
    if (!Number.isFinite(value))
      throw new RangeError("Nonfinite surface position");
  for (const index of ids)
    if (index >= p.length / 3)
      throw new RangeError("Surface index out of range");
  // ax, ay, az, bx-ax, bz-az, cx-ax, cz-az, inverse determinant,
  // slopeX, slopeZ. Coefficients use differences before multiplication.
  const faces = new Float64Array((ids.length / 3) * 10);
  const bins = new Map<string, number[]>();
  let references = 0,
    upwardFaces = 0;
  const cell = (v: number) => {
    const n = Math.floor(v / cellSize);
    if (!Number.isSafeInteger(n))
      throw new RangeError("Surface grid coordinate is not a safe integer");
    return n;
  };
  for (let triangle = 0; triangle < ids.length / 3; triangle++) {
    const a = ids[triangle * 3]! * 3,
      b = ids[triangle * 3 + 1]! * 3,
      c = ids[triangle * 3 + 2]! * 3;
    const ax = p[a]!,
      ay = p[a + 1]!,
      az = p[a + 2]!,
      bx = p[b]! - ax,
      bz = p[b + 2]! - az,
      cx = p[c]! - ax,
      cz = p[c + 2]! - az;
    const determinant = bx * cz - bz * cx;
    if (!Number.isFinite(determinant))
      throw new RangeError("Nonfinite surface determinant");
    // Cross-product Y is the negative XZ determinant.
    if (determinant >= 0) continue;
    const by = p[b + 1]! - ay,
      cy = p[c + 1]! - ay;
    const sx = (by * cz - bz * cy) / determinant,
      sz = (bx * cy - by * cx) / determinant,
      inv = 1 / determinant;
    if (![sx, sz, inv].every(Number.isFinite))
      throw new RangeError("Nonfinite surface coefficients");
    const minX = cell(Math.min(ax, p[b]!, p[c]!)),
      maxX = cell(Math.max(ax, p[b]!, p[c]!));
    const minZ = cell(Math.min(az, p[b + 2]!, p[c + 2]!)),
      maxZ = cell(Math.max(az, p[b + 2]!, p[c + 2]!));
    const count = (maxX - minX + 1) * (maxZ - minZ + 1);
    if (!Number.isSafeInteger(count) || count > maxReferences - references)
      throw new RangeError("Surface reference budget exceeded");
    faces.set([ax, ay, az, bx, bz, cx, cz, inv, sx, sz], triangle * 10);
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${z}`,
          bin = bins.get(key);
        if (bin) bin.push(triangle);
        else bins.set(key, [triangle]);
      }
    references += count;
    upwardFaces++;
  }
  const stats = Object.freeze({
    triangles: ids.length / 3,
    upwardFaces,
    cells: bins.size,
    references,
    coefficientBytes: faces.byteLength,
  });
  return {
    stats,
    /** Nearest upward surface to referenceY, with an inclusive distance bound.
     * Equal distances keep input triangle order. Missing coverage returns null;
     * no extrapolation or fallback height is fabricated. edgeTolerance is a
     * dimensionless barycentric tolerance, bounded to avoid broad false hits. */
    query(
      x: number,
      z: number,
      referenceY: number,
      maxDistance: number,
      edgeTolerance = 1e-8,
    ): { hit: UpwardSurfaceHit | null; trianglesTested: number } {
      if (
        ![x, z, referenceY, maxDistance, edgeTolerance].every(
          Number.isFinite,
        ) ||
        maxDistance < 0 ||
        edgeTolerance < 0 ||
        edgeTolerance > 1e-4
      )
        throw new RangeError("Invalid surface query");
      const bin = bins.get(`${cell(x)},${cell(z)}`);
      let hit: UpwardSurfaceHit | null = null,
        best = maxDistance;
      for (const triangle of bin ?? []) {
        const i = triangle * 10,
          dx = x - faces[i]!,
          dz = z - faces[i + 2]!;
        const u = (dx * faces[i + 6]! - dz * faces[i + 5]!) * faces[i + 7]!;
        const v = (faces[i + 3]! * dz - faces[i + 4]! * dx) * faces[i + 7]!;
        if (
          u < -edgeTolerance ||
          v < -edgeTolerance ||
          u + v > 1 + edgeTolerance
        )
          continue;
        const height = faces[i + 1]! + faces[i + 8]! * dx + faces[i + 9]! * dz;
        if (!Number.isFinite(height))
          throw new RangeError("Nonfinite queried height");
        const distance = Math.abs(height - referenceY);
        if (!Number.isFinite(distance))
          throw new RangeError("Nonfinite queried distance");
        if (distance <= best && (!hit || distance < best)) {
          best = distance;
          hit = {
            height,
            slopeX: faces[i + 8]!,
            slopeZ: faces[i + 9]!,
            triangle,
          };
        }
      }
      return { hit, trianglesTested: bin?.length ?? 0 };
    },
  };
}
