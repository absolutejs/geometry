import { closedComponents } from "./closedComponents.js";
import { signedVolume } from "./signedVolume.js";
import type { OverlapMesh } from "./overlap.js";

export type StarPartitionOptions = {
  /** Allocation/work limit, 4–1024; defaults to 256 surface triangles. */
  maximumTriangles?: number;
  /** Minimum kernel-to-face distance divided by source extent; default 1e-9. */
  minimumRelativeClearance?: number;
};
export type StarPartitionPiece = OverlapMesh & {
  sourceTriangle: number;
  volume: number;
};
export type StarPartition = {
  origin: [number, number, number];
  pieces: StarPartitionPiece[];
  volume: number;
  minimumKernelClearance: number;
  scope: "kernel-fan-candidates";
};
const tetraIndices = new Uint32Array([1, 2, 3, 0, 2, 1, 0, 3, 2, 0, 1, 3]);
/** Build convex tetrahedron candidates from an already-qualified simple,
 * outward-oriented, star-shaped boundary and a supplied strict interior kernel.
 * Checks connected closed topology and every face halfspace; never searches for
 * a kernel, repairs topology, welds by proximity or substitutes a whole-solid hull.
 * An intersection-free boundary is an input precondition, not certified here. Consumers must
 * independently audit coverage/overlap and their collision engine's exported
 * geometry/mass before adopting a partition. Output coordinates are kernel-local.
 */
export function partitionStarShapedMesh(
  mesh: OverlapMesh,
  kernel: readonly [number, number, number],
  options: StarPartitionOptions = {},
): StarPartition {
  const maximumTriangles = options.maximumTriangles ?? 256;
  const relativeClearance = options.minimumRelativeClearance ?? 1e-9;
  if (
    !Number.isInteger(maximumTriangles) ||
    maximumTriangles < 4 ||
    maximumTriangles > 1024 ||
    !Number.isFinite(relativeClearance) ||
    relativeClearance < 1e-12 ||
    relativeClearance > 0.1
  )
    throw Error("Invalid star partition budget or clearance");
  if (
    !mesh ||
    !(mesh.positions instanceof Float64Array) ||
    !(mesh.indices instanceof Uint32Array) ||
    !(mesh.positions.buffer instanceof ArrayBuffer) ||
    !(mesh.indices.buffer instanceof ArrayBuffer) ||
    mesh.positions.length % 3 ||
    mesh.indices.length % 3 ||
    mesh.indices.length < 12 ||
    mesh.indices.length > maximumTriangles * 3 ||
    mesh.positions.length > maximumTriangles * 9 ||
    !mesh.positions.every(Number.isFinite) ||
    !Array.isArray(kernel) ||
    kernel.length !== 3 ||
    !kernel.every(Number.isFinite)
  )
    throw Error("Invalid or over-budget star partition input");
  if (closedComponents(mesh.positions, mesh.indices).length !== 1)
    throw Error("Star partition requires one closed connected boundary");
  const local = new Float64Array(mesh.positions.length),
    used = new Uint8Array(mesh.positions.length / 3);
  for (const id of mesh.indices) used[id] = 1;
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < local.length; i++) {
    if (!used[Math.floor(i / 3)]) continue;
    const axis = i % 3,
      v = mesh.positions[i]! - kernel[axis]!;
    if (!Number.isFinite(v)) throw Error("Nonfinite kernel-local coordinate");
    local[i] = v;
    lo[axis] = Math.min(lo[axis]!, v);
    hi[axis] = Math.max(hi[axis]!, v);
  }
  const extent = Math.max(...hi.map((v, i) => v - lo[i]!)),
    volumeScale = extent ** 3;
  if (!(volumeScale > 0) || !Number.isFinite(volumeScale))
    throw Error("Unrepresentable star partition scale");
  const pieces: StarPartitionPiece[] = [];
  let minimumKernelClearance = Infinity,
    volume = 0,
    compensation = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const positions = new Float64Array(12);
    for (let j = 0; j < 3; j++) {
      const i = mesh.indices[t + j]! * 3;
      positions.set(local.subarray(i, i + 3), (j + 1) * 3);
    }
    const ax = positions[3]!,
      ay = positions[4]!,
      az = positions[5]!,
      bx = positions[6]!,
      by = positions[7]!,
      bz = positions[8]!,
      cx = positions[9]!,
      cy = positions[10]!,
      cz = positions[11]!;
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay),
      ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az),
      nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const determinant = ax * nx + ay * ny + az * nz,
      area = Math.hypot(nx, ny, nz),
      clearance = determinant / area;
    if (
      !Number.isFinite(clearance) ||
      clearance <= extent * relativeClearance ||
      !Number.isFinite(determinant) ||
      determinant <= volumeScale * 1e-14
    )
      throw Error("Kernel is outside, on or too close to a boundary face");
    const pieceVolume = determinant / 6;
    minimumKernelClearance = Math.min(minimumKernelClearance, clearance);
    const increment = pieceVolume - compensation,
      next = volume + increment;
    compensation = next - volume - increment;
    volume = next;
    pieces.push({
      positions,
      indices: tetraIndices.slice(),
      sourceTriangle: t / 3,
      volume: pieceVolume,
    });
  }
  const sourceVolume = signedVolume(local, mesh.indices);
  if (
    !(sourceVolume > 0) ||
    !Number.isFinite(volume) ||
    Math.abs(sourceVolume - volume) > Math.max(sourceVolume, volume) * 1e-9
  )
    throw Error("Star partition signed volume disagrees with its source");
  return {
    origin: [kernel[0]!, kernel[1]!, kernel[2]!],
    pieces,
    volume,
    minimumKernelClearance,
    scope: "kernel-fan-candidates",
  };
}
