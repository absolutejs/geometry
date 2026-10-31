import type { Manifold, ManifoldToplevel } from "manifold-3d";
import { createManifoldPartitionKernel } from "./manifoldKernel.js";
import type { OverlapMesh } from "./overlap.js";
import { closedComponents } from "./closedComponents.js";
import { regularizeZeroExtentShells } from "./regularizeZeroExtentShells.js";
import { auditSurfaceOrigins, type SurfaceOrigins } from "./surfaceOrigins.js";
import { signedVolume } from "./signedVolume.js";

/** Transactional bounded solid editing in one caller-chosen common frame. The
 * session unions initial sources and keeps retained native geometry between cuts.
 * Output copies retain original source/face/backside ancestry. Exactly axis-
 * collapsed disconnected shells are reported and omitted from exported material.
 * No epsilon regularization or coordinate-frame guessing is performed. Dispose
 * explicitly; caller owns WASM loading, worker isolation and cancellation. */
export function createManifoldCutSession(
  wasm: ManifoldToplevel,
  inputs: readonly OverlapMesh[],
  maximumCuts = Math.min(32, 64 - inputs.length),
) {
  if (
    !Array.isArray(inputs) ||
    inputs.length < 1 ||
    inputs.length > 63 ||
    !Number.isSafeInteger(maximumCuts) ||
    maximumCuts < 1 ||
    maximumCuts > 32 ||
    inputs.length + maximumCuts > 64
  )
    throw Error("Invalid native cut session budget");
  const copy = (mesh: OverlapMesh): OverlapMesh => {
    if (
      !(mesh?.positions instanceof Float64Array) ||
      !(mesh?.indices instanceof Uint32Array) ||
      !mesh.indices.length ||
      !mesh.positions.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000)
    )
      throw Error("Invalid native cut session mesh");
    closedComponents(mesh.positions, mesh.indices);
    if (!(signedVolume(mesh.positions, mesh.indices) > 0))
      throw Error("Nonpositive native cut session source");
    return { positions: mesh.positions.slice(), indices: mesh.indices.slice() };
  };
  const budget = (meshes: readonly OverlapMesh[]) => {
    if (
      meshes.reduce((n, m) => n + m.positions.length, 0) > 300000 ||
      meshes.reduce((n, m) => n + m.indices.length, 0) > 600000
    )
      throw Error("Native cut session source budget exceeded");
  };
  budget(inputs);
  let sources = inputs.map(copy),
    current: Manifold | null = null,
    cuts = 0,
    busy = false;
  const kernel = createManifoldPartitionKernel(
    wasm,
    inputs.length + maximumCuts,
  );
  const emptySnapshot = (nativeEvaluated: boolean) => ({
    positions: new Float64Array(),
    indices: new Uint32Array(),
    origins: {
      sources: new Uint16Array(),
      faces: new Uint32Array(),
      reversed: new Uint8Array(),
    },
    volume: 0,
    removedSheets: [] as ReturnType<
      typeof regularizeZeroExtentShells
    >["removed"],
    stats: {
      nativeEvaluated,
      nativeTriangles: 0,
      nativeVertices: 0,
      nativeVolume: 0,
      nativeTolerance: null as number | null,
      exportedTriangles: 0,
      removedSheetTriangles: 0,
    },
  });
  const check = (solid: Manifold) => {
    const status = solid.status(),
      triangles = solid.numTri(),
      vertices = solid.numVert(),
      tolerance = solid.isEmpty() ? null : solid.tolerance();
    if (
      status !== "NoError" ||
      triangles > 200000 ||
      vertices > 100000 ||
      (tolerance !== null && (!Number.isFinite(tolerance) || tolerance > 1e-5))
    )
      throw Error("Native cut session output budget exceeded", {
        cause: { status, triangles, vertices, tolerance },
      });
  };
  const exported = (solid: Manifold, ancestry: readonly OverlapMesh[]) => {
    check(solid);
    if (solid.isEmpty()) return emptySnapshot(true);
    const raw = kernel.mesh(solid),
      regular = regularizeZeroExtentShells(raw.positions, raw.indices);
    const origins: SurfaceOrigins = {
      sources: Uint16Array.from(
        regular.sourceTriangles,
        (t) => raw.origins.sources[t]!,
      ),
      faces: Uint32Array.from(
        regular.sourceTriangles,
        (t) => raw.origins.faces[t]!,
      ),
      reversed: Uint8Array.from(
        regular.sourceTriangles,
        (t) => raw.origins.reversed[t]!,
      ),
    };
    auditSurfaceOrigins(regular, origins, ancestry);
    const volume = regular.indices.length
      ? signedVolume(regular.positions, regular.indices)
      : 0;
    if (!Number.isFinite(volume) || (regular.indices.length && volume <= 0))
      throw Error("Nonpositive native cut session output");
    return {
      positions: regular.positions,
      indices: regular.indices,
      origins,
      volume,
      removedSheets: regular.removed,
      stats: {
        nativeEvaluated: true,
        nativeTriangles: solid.numTri(),
        nativeVertices: solid.numVert(),
        nativeVolume: solid.volume(),
        nativeTolerance: solid.tolerance(),
        exportedTriangles: regular.indices.length / 3,
        removedSheetTriangles: regular.removed.reduce(
          (n, s) => n + s.sourceTriangles.length,
          0,
        ),
      },
    };
  };
  try {
    for (const [id, mesh] of sources.entries()) {
      const next = kernel.create(mesh, id);
      if (!current) {
        current = next;
        continue;
      }
      try {
        const joined = kernel.union(current, next);
        current.delete();
        current = joined;
      } finally {
        next.delete();
      }
    }
    exported(current!, sources);
  } catch (error) {
    current?.delete();
    throw error;
  }
  const active = () => {
    if (!current) throw Error("Native cut session is disposed");
    if (busy) throw Error("Native cut session is busy");
    return current;
  };
  return {
    snapshot() {
      return exported(active(), sources);
    },
    get cuts() {
      active();
      return cuts;
    },
    cut(mesh: OverlapMesh) {
      const previous = active();
      const cutterMesh = copy(mesh);
      const low = [Infinity, Infinity, Infinity],
        high = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < cutterMesh.positions.length; i++) {
        const k = i % 3;
        low[k] = Math.min(low[k]!, cutterMesh.positions[i]!);
        high[k] = Math.max(high[k]!, cutterMesh.positions[i]!);
      }
      const bounds = previous.boundingBox();
      // Disjoint or merely touching bounds cannot remove a 3D material interior.
      if (
        previous.isEmpty() ||
        low.some((v, k) => v >= bounds.max[k]! || high[k]! <= bounds.min[k]!)
      )
        return {
          changed: false as const,
          sequence: cuts,
          retained: exported(previous, sources),
          removed: emptySnapshot(false),
          relativeVolumeError: 0,
          broadPhaseSkipped: true,
        };
      if (cuts >= maximumCuts)
        throw Error("Native cut session cut budget exceeded");
      const nextSources = [...sources, cutterMesh];
      budget(nextSources);
      busy = true;
      let cutter: Manifold | undefined,
        removed: Manifold | undefined,
        retained: Manifold | undefined;
      try {
        cutter = kernel.create(cutterMesh, sources.length);
        [removed, retained] = previous.split(cutter);
        const removedMesh = exported(removed, nextSources),
          retainedMesh = exported(retained, nextSources);
        const before = previous.volume(),
          relativeVolumeError = Math.abs(
            (removedMesh.volume + retainedMesh.volume) / before - 1,
          );
        if (
          !(before > 0) ||
          !Number.isFinite(relativeVolumeError) ||
          relativeVolumeError > 1e-8
        )
          throw Error("Native cut session conservation mismatch");
        if (!removedMesh.indices.length)
          return {
            changed: false as const,
            sequence: cuts,
            retained: exported(previous, sources),
            removed: removedMesh,
            relativeVolumeError,
            broadPhaseSkipped: false,
          };
        current = retained;
        retained = undefined;
        previous.delete();
        sources = nextSources;
        cuts++;
        return {
          changed: true as const,
          sequence: cuts,
          retained: retainedMesh,
          removed: removedMesh,
          relativeVolumeError,
          broadPhaseSkipped: false,
        };
      } finally {
        retained?.delete();
        removed?.delete();
        cutter?.delete();
        busy = false;
      }
    },
    dispose() {
      if (busy) throw Error("Native cut session is busy");
      current?.delete();
      current = null;
      sources = [];
    },
  };
}
