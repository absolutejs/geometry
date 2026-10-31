import { closedComponents } from "./closedComponents.js";

/** Remove disconnected closed shells with exactly zero coordinate extent on at
 * least one axis. Such shells have no 3D interior. This is a deliberately narrow
 * regularization certificate: no epsilon, signed-volume threshold, welding or
 * arbitrary triangle removal. Non-axis-aligned flat shells and every nonzero
 * thickness are retained. Run before changing the frame that makes a tool plane
 * exact. Input topology must be closed; this is not a general Boolean repair.
 * Output arrays and per-shell source-face maps are owned copies. */
export function regularizeZeroExtentShells(
  positions: Float64Array,
  indices: Uint32Array,
) {
  const shells = closedComponents(positions, indices);
  const points: number[] = [],
    faces: number[] = [],
    sources: number[] = [];
  const removed: {
    axis: number;
    coordinate: number;
    sourceTriangles: Uint32Array;
  }[] = [];
  let retainedShells = 0;
  for (const shell of shells) {
    const low = [Infinity, Infinity, Infinity],
      high = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < shell.positions.length; i++) {
      const k = i % 3;
      low[k] = Math.min(low[k]!, shell.positions[i]!);
      high[k] = Math.max(high[k]!, shell.positions[i]!);
    }
    const axis = low.findIndex((v, k) => v === high[k]);
    if (axis >= 0) {
      removed.push({
        axis,
        coordinate: low[axis]!,
        sourceTriangles: shell.sourceTriangles.slice(),
      });
      continue;
    }
    retainedShells++;
    const offset = points.length / 3;
    for (const p of shell.positions) points.push(p);
    for (const i of shell.indices) faces.push(i + offset);
    for (const t of shell.sourceTriangles) sources.push(t);
  }
  return {
    positions: Float64Array.from(points),
    indices: Uint32Array.from(faces),
    sourceTriangles: Uint32Array.from(sources),
    retainedShells,
    removed,
  };
}
