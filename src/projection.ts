export type AlphaProjectionInput = {
  /** xyz coordinates in the requested projection frame; projection is onto xz. */
  positions: Float32Array | Float64Array;
  uv: Float32Array | Float64Array;
  indices: Uint16Array | Uint32Array;
  alpha: Uint8Array;
  textureWidth: number;
  textureHeight: number;
  cutoff: number;
  wrapS?: "clamp" | "repeat" | "mirror";
  wrapT?: "clamp" | "repeat" | "mirror";
  resolution?: number;
  maxPixelTests?: number;
};
export type AlphaProjection = {
  revision: "alpha-projection-1";
  resolution: number;
  /** 0 outside projected vertex hull, 1 open ray, 2 alpha-covered ray. */
  cells: Uint8Array;
  bounds: [number, number, number, number];
  footprintArea: number;
  sampledFootprintArea: number;
  sampledCoveredArea: number;
  coveredArea: number;
  gapFraction: number;
  coveredCells: number;
  footprintCells: number;
  pixelTests: number;
  alphaTests: number;
  triangles: number;
  cellArea: number;
};
/** Deterministic setup/worker-time orthographic coverage. Triangle-local raster
 * bounds and union early-outs avoid a ray/triangle cartesian product. The convex
 * projected vertex hull defines the explicit reference area. Center sampling is
 * approximate; qualify resolution convergence. No water, transmission or wind. */
export function projectAlphaCoverage(
  input: AlphaProjectionInput,
): AlphaProjection {
  const {
    positions: p,
    uv,
    indices,
    alpha,
    textureWidth: w,
    textureHeight: h,
    cutoff,
  } = input;
  const n = input.resolution ?? 256,
    limit = input.maxPixelTests ?? 50000000;
  const wrapS = input.wrapS ?? "clamp",
    wrapT = input.wrapT ?? "clamp";
  if (
    !(p instanceof Float32Array || p instanceof Float64Array) ||
    !(uv instanceof Float32Array || uv instanceof Float64Array) ||
    !(indices instanceof Uint16Array || indices instanceof Uint32Array) ||
    !(alpha instanceof Uint8Array) ||
    p.length % 3 ||
    p.length < 9 ||
    p.length > 900000 ||
    uv.length !== (p.length / 3) * 2 ||
    indices.length % 3 ||
    indices.length < 3 ||
    indices.length > 600000 ||
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    w * h > 4194304 ||
    alpha.length !== w * h ||
    !Number.isFinite(cutoff) ||
    cutoff <= 0 ||
    cutoff >= 1 ||
    !Number.isInteger(n) ||
    n < 8 ||
    n > 1024 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100000000 ||
    !["clamp", "repeat", "mirror"].includes(wrapS) ||
    !["clamp", "repeat", "mirror"].includes(wrapT)
  )
    throw Error("Invalid alpha projection input");
  const count = p.length / 3;
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  const used = new Uint8Array(count);
  for (const id of indices) {
    if (id >= count) throw Error("Invalid projection index");
    used[id] = 1;
  }
  for (let i = 0; i < count; i++) {
    if (
      ![p[i * 3], p[i * 3 + 1], p[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]].every(
        Number.isFinite,
      ) ||
      Math.abs(uv[i * 2]!) > 1e6 ||
      Math.abs(uv[i * 2 + 1]!) > 1e6
    )
      throw Error("Nonfinite or unbounded projection vertex");
    if (!used[i]) continue;
    minX = Math.min(minX, p[i * 3]!);
    maxX = Math.max(maxX, p[i * 3]!);
    minZ = Math.min(minZ, p[i * 3 + 2]!);
    maxZ = Math.max(maxZ, p[i * 3 + 2]!);
  }
  const spanX = maxX - minX,
    spanZ = maxZ - minZ;
  if (!Number.isFinite(spanX * spanZ) || spanX <= 0 || spanZ <= 0)
    throw Error("Degenerate projection footprint");
  const coordinates = new Float64Array(count * 2),
    points: number[] = [];
  for (let i = 0; i < count; i++) {
    coordinates[i * 2] = p[i * 3]! - minX;
    coordinates[i * 2 + 1] = p[i * 3 + 2]! - minZ;
    if (used[i]) points.push(i);
  }
  points.sort(
    (a, b) =>
      coordinates[a * 2]! - coordinates[b * 2]! ||
      coordinates[a * 2 + 1]! - coordinates[b * 2 + 1]!,
  );
  const cross = (a: number, b: number, c: number) =>
    (coordinates[b * 2]! - coordinates[a * 2]!) *
      (coordinates[c * 2 + 1]! - coordinates[a * 2 + 1]!) -
    (coordinates[b * 2 + 1]! - coordinates[a * 2 + 1]!) *
      (coordinates[c * 2]! - coordinates[a * 2]!);
  const lower: number[] = [],
    upper: number[] = [];
  for (const id of points) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, id) <= 0)
      lower.pop();
    lower.push(id);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const id = points[i]!;
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, id) <= 0)
      upper.pop();
    upper.push(id);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!,
      b = hull[(i + 1) % hull.length]!;
    area +=
      coordinates[a * 2]! * coordinates[b * 2 + 1]! -
      coordinates[b * 2]! * coordinates[a * 2 + 1]!;
  }
  area = Math.abs(area) / 2;
  if (!Number.isFinite(area) || !(area > 0))
    throw Error("Degenerate projected vertex hull");
  const dx = spanX / n,
    dz = spanZ / n,
    cells = new Uint8Array(n * n);
  let footprintCells = 0;
  // Walk hull edges once. A convex hull has at most two crossings per row,
  // avoiding resolution × hull-vertex work on highly detailed assets.
  const lefts = new Float64Array(n).fill(Infinity);
  const rights = new Float64Array(n).fill(-Infinity);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!, b = hull[(i + 1) % hull.length]!;
    const az = coordinates[a * 2 + 1]!, bz = coordinates[b * 2 + 1]!;
    if (az === bz) continue;
    const firstRow = Math.max(0, Math.ceil(Math.min(az, bz) / dz - 0.5));
    const endRow = Math.min(n, Math.ceil(Math.max(az, bz) / dz - 0.5));
    for (let row = firstRow; row < endRow; row++) {
      const z = (row + 0.5) * dz;
      const x = coordinates[a * 2]! +
        ((z - az) / (bz - az)) * (coordinates[b * 2]! - coordinates[a * 2]!);
      lefts[row] = Math.min(lefts[row]!, x);
      rights[row] = Math.max(rights[row]!, x);
    }
  }
  for (let row = 0; row < n; row++) {
    const left = lefts[row]!, right = rights[row]!;
    const first = Math.max(0, Math.ceil(left / dx - 0.5)),
      last = Math.min(n - 1, Math.floor(right / dx - 0.5));
    for (let col = first; col <= last; col++) {
      cells[row * n + col] = 1;
      footprintCells++;
    }
  }
  if (!footprintCells) throw Error("Projection footprint is unresolved");
  const wrap = (index: number, size: number, mode: string) => {
    if (mode === "clamp") return Math.max(0, Math.min(size - 1, index));
    const period = mode === "mirror" ? size * 2 : size,
      t = ((index % period) + period) % period;
    return t < size ? t : period - 1 - t;
  };
  const sample = (u: number, v: number) => {
    const x = u * w - 0.5,
      y = v * h - 0.5,
      ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const x0 = wrap(ix, w, wrapS),
      x1 = wrap(ix + 1, w, wrapS),
      y0 = wrap(iy, h, wrapT),
      y1 = wrap(iy + 1, h, wrapT);
    return (
      (alpha[y0 * w + x0]! * (1 - fx) + alpha[y0 * w + x1]! * fx) * (1 - fy) +
      (alpha[y1 * w + x0]! * (1 - fx) + alpha[y1 * w + x1]! * fx) * fy
    );
  };
  let pixelTests = 0,
    alphaTests = 0,
    coveredCells = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!,
      b = indices[t + 1]!,
      c = indices[t + 2]!;
    const ax = coordinates[a * 2]!,
      az = coordinates[a * 2 + 1]!,
      bx = coordinates[b * 2]!,
      bz = coordinates[b * 2 + 1]!,
      cx = coordinates[c * 2]!,
      cz = coordinates[c * 2 + 1]!;
    const den = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(den) <= Number.EPSILON * (spanX * spanZ)) continue;
    const firstX = Math.max(0, Math.ceil(Math.min(ax, bx, cx) / dx - 0.5)),
      lastX = Math.min(n - 1, Math.floor(Math.max(ax, bx, cx) / dx - 0.5));
    const firstZ = Math.max(0, Math.ceil(Math.min(az, bz, cz) / dz - 0.5)),
      lastZ = Math.min(n - 1, Math.floor(Math.max(az, bz, cz) / dz - 0.5));
    const work =
      Math.max(0, lastX - firstX + 1) * Math.max(0, lastZ - firstZ + 1);
    if (pixelTests + work > limit)
      throw Error("Alpha projection pixel-test budget exceeded");
    pixelTests += work;
    for (let row = firstZ; row <= lastZ; row++)
      for (let col = firstX; col <= lastX; col++) {
        const cell = row * n + col;
        if (cells[cell] !== 1) continue;
        const rx = (col + 0.5) * dx - ax,
          rz = (row + 0.5) * dz - az;
        const b1 = (rx * (cz - az) - rz * (cx - ax)) / den,
          b2 = ((bx - ax) * rz - (bz - az) * rx) / den,
          b0 = 1 - b1 - b2;
        if (b0 < -1e-10 || b1 < -1e-10 || b2 < -1e-10) continue;
        alphaTests++;
        if (
          sample(
            uv[a * 2]! * b0 + uv[b * 2]! * b1 + uv[c * 2]! * b2,
            uv[a * 2 + 1]! * b0 + uv[b * 2 + 1]! * b1 + uv[c * 2 + 1]! * b2,
          ) >=
          cutoff * 255
        ) {
          cells[cell] = 2;
          coveredCells++;
        }
      }
  }
  const cellArea = dx * dz;
  return {
    revision: "alpha-projection-1",
    resolution: n,
    cells,
    bounds: [minX, minZ, maxX, maxZ],
    footprintArea: area,
    sampledFootprintArea: footprintCells * cellArea,
    sampledCoveredArea: coveredCells * cellArea,
    coveredArea: (area * coveredCells) / footprintCells,
    gapFraction: 1 - coveredCells / footprintCells,
    coveredCells,
    footprintCells,
    pixelTests,
    alphaTests,
    triangles: indices.length / 3,
    cellArea,
  };
}
