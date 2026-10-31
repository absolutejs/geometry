import type { Manifold, ManifoldToplevel } from "manifold-3d";
import type { OverlapMesh } from "./overlap.js";
import { createManifoldMesh64 } from "./createManifoldMesh64.js";
import { getManifoldMesh64 } from "./manifoldMesh64.js";
import { mergeIndexedMesh } from "./mergeIndexedMesh.js";
import { regularizeZeroExtentShells } from "./regularizeZeroExtentShells.js";
import { solidComponents } from "./solidComponents.js";
import { closedComponents } from "./closedComponents.js";
import { signedVolume } from "./signedVolume.js";
const triangleKey = (
  positions: Float64Array,
  indices: Uint32Array,
  t: number,
) =>
  [0, 1, 2]
    .map((k) => {
      const v = indices[t * 3 + k]! * 3;
      return `${positions[v]},${positions[v + 1]},${positions[v + 2]}`;
    })
    .sort()
    .join(";");
/** Read-only native material coverage. Target intermediates are never serialized
 * back into the kernel. Cells are assigned by measured intersection, with cross-
 * body overlap reported separately; this is not a convexity/contact certificate.
 * Caller owns target and WASM lifetime; all temporary handles are released. */
export function auditManifoldCoverage(
  wasm: ManifoldToplevel,
  target: Manifold,
  candidates: readonly OverlapMesh[],
) {
  if (
    !Array.isArray(candidates) ||
    candidates.length > 128 ||
    candidates.some(
      (m) =>
        !(m?.positions instanceof Float64Array) ||
        !(m.indices instanceof Uint32Array) ||
        !(m.positions.buffer instanceof ArrayBuffer) ||
        !(m.indices.buffer instanceof ArrayBuffer),
    ) ||
    candidates.reduce((n, m) => n + m.positions.length, 0) > 300000 ||
    candidates.reduce((n, m) => n + m.indices.length, 0) > 600000
  )
    throw Error("Invalid native coverage candidate budget");
  const handles: Manifold[] = [],
    own = (m: Manifold) => {
      handles.push(m);
      return m;
    };
  let nativeBooleanQueries = 0,
    regularizedQuerySheets = 0;
  const checked = (m: Manifold) => {
    if (m.status() !== "NoError" || m.numVert() > 100000 || m.numTri() > 200000)
      throw Error("Native coverage output budget exceeded");
    return m;
  };
  const mesh = (m: Manifold) => {
    checked(m);
    if (m.isEmpty())
      return {
        positions: new Float64Array(),
        indices: new Uint32Array(),
        removed: [],
      };
    const raw = mergeIndexedMesh(
      getManifoldMesh64(m),
      [0, 0, 0],
      m.tolerance(),
    );
    if (!raw.positions.every((v) => Number.isFinite(v) && Math.abs(v) <= 1000))
      throw Error("Native coverage coordinate budget exceeded");
    return regularizeZeroExtentShells(raw.positions, raw.indices);
  };
  const measure = (m: Manifold) => {
    checked(m);
    const volume = m.volume();
    if (!Number.isFinite(volume))
      throw Error("Nonfinite native coverage volume");
    if (volume >= 0) return volume;
    const regular = mesh(m);
    if (regular.indices.length === 0) {
      regularizedQuerySheets += regular.removed.length;
      return 0;
    }
    throw Error("Unresolved negative native coverage volume");
  };
  try {
    const boundary = mesh(target),
      material = boundary.indices.length
        ? solidComponents(
            boundary.positions,
            boundary.indices,
            new Uint16Array(boundary.indices.length / 3),
          )
        : { components: [], shells: 0, cavities: 0 };
    if (material.components.length > 32 || material.shells > 128)
      throw Error("Native coverage component budget exceeded");
    const faceOwners = new Map<string, number>();
    for (const [i, component] of material.components.entries())
      for (let t = 0; t < component.indices.length / 3; t++) {
        const key = triangleKey(component.positions, component.indices, t);
        if (faceOwners.has(key))
          throw Error("Ambiguous native coverage triangle");
        faceOwners.set(key, i);
      }
    const grouped: Manifold[][] = material.components.map(() => []),
      seen = new Set<string>();
    let removedZeroExtentShells = 0;
    const shellVolumes = new Map<Manifold, number>();
    // Native decomposition exposes oriented shells without a Float32 reconstruction.
    const nativeShells = checked(target).decompose();
    nativeShells.forEach(own);
    if (nativeShells.length > 128)
      throw Error("Native coverage shell budget exceeded");
    for (const shell of nativeShells) {
      const regular = mesh(shell);
      if (!regular.indices.length) {
        removedZeroExtentShells += regular.removed.length;
        continue;
      }
      let owner: number | undefined;
      for (let t = 0; t < regular.indices.length / 3; t++) {
        const key = triangleKey(regular.positions, regular.indices, t),
          id = faceOwners.get(key);
        if (
          id === undefined ||
          seen.has(key) ||
          (owner !== undefined && owner !== id)
        )
          throw Error("Native coverage shell correspondence failed");
        owner = id;
        seen.add(key);
      }
      grouped[owner!]!.push(shell);
      shellVolumes.set(shell, signedVolume(regular.positions, regular.indices));
    }
    if (seen.size !== faceOwners.size)
      throw Error("Incomplete native coverage shell correspondence");
    const positive = grouped.map((shells) => {
      const outer = shells.filter((s) => shellVolumes.get(s)! > 0);
      if (outer.length !== 1) throw Error("Ambiguous native coverage exterior");
      return outer[0]!;
    });
    const bodies = grouped.map((shells, i) => {
      const outer = positive[i]!;
      // The pinned JS compose() is a Boolean union: it fills negative cavity walls.
      // Retain cavities by intersecting the original native material with its outer
      // shell, then excluding smaller nested positive islands belonging to other bodies.
      let native: Manifold;
      if (shells.length === 1) native = own(outer.translate([0, 0, 0]));
      else {
        native = own(target.intersect(outer));
        nativeBooleanQueries++;
        for (const other of positive)
          if (
            other !== outer &&
            shellVolumes.get(other)! < shellVolumes.get(outer)!
          ) {
            const a = native.boundingBox(),
              b = other.boundingBox();
            if (
              a.min.some((v, k) => v >= b.max[k]!) ||
              a.max.some((v, k) => v <= b.min[k]!)
            )
              continue;
            native = own(native.subtract(other));
            nativeBooleanQueries++;
          }
      }
      const volume = signedVolume(
          material.components[i]!.positions,
          material.components[i]!.indices,
        ),
        nativeVolume = measure(native);
      if (!(volume > 0) || Math.abs(nativeVolume / volume - 1) > 1e-8)
        throw Error("Native coverage component volume disagreement");
      return { native, volume, nativeVolume };
    });
    const assigned: Manifold[][] = bodies.map(() => []),
      assignedIndices: number[][] = bodies.map(() => []);
    const cells = candidates.map((candidate: OverlapMesh, index: number) => {
      if (
        !candidate.positions.every(
          (v) => Number.isFinite(v) && Math.abs(v) <= 1000,
        )
      )
        throw Error("Native coverage candidate coordinates exceeded");
      closedComponents(candidate.positions, candidate.indices);
      if (!(signedVolume(candidate.positions, candidate.indices) > 0))
        throw Error("Nonpositive native coverage candidate");
      const native = own(
          createManifoldMesh64(wasm, {
            numProp: 3,
            vertProperties: candidate.positions,
            triVerts: candidate.indices,
          }),
        ),
        volume = measure(native);
      if (!(volume > 0)) throw Error("Empty native coverage candidate");
      const box = native.boundingBox();
      const intersections = bodies.map(({ native: body }) => {
        const other = body.boundingBox();
        if (
          box.min.some((v, k) => v >= other.max[k]!) ||
          box.max.some((v, k) => v <= other.min[k]!)
        )
          return 0;
        const overlap = native.intersect(body);
        nativeBooleanQueries++;
        try {
          return measure(overlap);
        } finally {
          overlap.delete();
        }
      });
      const best = Math.max(0, ...intersections),
        owner = best > 0 ? intersections.indexOf(best) : -1;
      if (owner >= 0) {
        assigned[owner]!.push(native);
        assignedIndices[owner]!.push(index);
      }
      return {
        volume,
        owner,
        intersections,
        outsideAssignedVolume: volume - best,
        crossComponentVolume: intersections.reduce((a, b) => a + b, 0) - best,
      };
    });
    const components = bodies.map((body, i) => {
      const members = assigned[i]!;
      let missingVolume = body.nativeVolume,
        excessVolume = 0;
      if (members.length) {
        const union = own(wasm.Manifold.union(members));
        checked(union);
        const missing = own(body.native.subtract(union)),
          excess = own(union.subtract(body.native));
        nativeBooleanQueries += 3;
        missingVolume = measure(missing);
        excessVolume = measure(excess);
      }
      return {
        mesh: material.components[i]!,
        volume: body.volume,
        nativeVolume: body.nativeVolume,
        candidates: assignedIndices[i]!,
        missingVolume,
        excessVolume,
        relativeMissing: missingVolume / body.volume,
        relativeExcess: excessVolume / body.volume,
      };
    });
    return {
      target: { positions: boundary.positions, indices: boundary.indices },
      components,
      cells,
      removedZeroExtentShells,
      regularizedQuerySheets,
      nativeBooleanQueries,
      cavities: material.cavities,
    };
  } finally {
    for (const h of handles.reverse()) h.delete();
  }
}
