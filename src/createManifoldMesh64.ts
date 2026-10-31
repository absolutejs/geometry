import type { ManifoldToplevel, MeshOptions } from "manifold-3d";

export type ManifoldMesh64Input = Omit<
  MeshOptions,
  "vertProperties" | "numProp"
> & {
  numProp: 3;
  vertProperties: Float64Array;
};
/** Import position-only geometry without leaving its native coordinates rounded to
 * Float32. The public Mesh constructor requires Float32, so restore original
 * coordinates using native warp before any Boolean operation. Reject ambiguous
 * Float32 vertices and import topology loss instead of guessing correspondence.
 * Caller owns the returned handle; all intermediate handles are released.
 * This is not a topology repair or self-intersection certificate. */
export function createManifoldMesh64(
  wasm: ManifoldToplevel,
  mesh: ManifoldMesh64Input,
) {
  const p = mesh.vertProperties;
  if (
    mesh.numProp !== 3 ||
    !(p instanceof Float64Array) ||
    p.length < 12 ||
    p.length % 3 ||
    p.length > 300000 ||
    !(mesh.triVerts instanceof Uint32Array) ||
    mesh.triVerts.length < 12 ||
    mesh.triVerts.length % 3 ||
    mesh.triVerts.length > 600000
  )
    throw Error("Invalid Manifold double import budget");
  const rounded = Float32Array.from(p);
  const exact = new Map<string, number>();
  for (let i = 0; i < p.length; i += 3) {
    if (
      ![
        p[i],
        p[i + 1],
        p[i + 2],
        rounded[i],
        rounded[i + 1],
        rounded[i + 2],
      ].every(Number.isFinite)
    )
      throw Error("Nonfinite Manifold double import vertex");
    const key = `${rounded[i]},${rounded[i + 1]},${rounded[i + 2]}`;
    const old = exact.get(key);
    if (
      old !== undefined &&
      (p[old] !== p[i] || p[old + 1] !== p[i + 1] || p[old + 2] !== p[i + 2])
    )
      throw Error("Manifold double import has collapsed Float32 vertices");
    exact.set(key, i);
  }
  if (!mesh.triVerts.every((i) => i < p.length / 3))
    throw Error("Invalid Manifold double import index");
  const seed = new wasm.Manifold(
    new wasm.Mesh({ ...mesh, vertProperties: rounded }),
  );
  try {
    if (
      seed.status() !== "NoError" ||
      seed.numTri() !== mesh.triVerts.length / 3 ||
      seed.numVert() !== exact.size
    )
      throw Error("Manifold double import changed topology");
    let unknownVertex = false;
    const restored = seed.warp((position) => {
      const i = exact.get(position.join(","));
      // Do not throw from the native callback: the pinned wrapper removes its
      // callback-table entry only after _Warp returns. Fail after it returns.
      if (i === undefined) {
        unknownVertex = true;
        return;
      }
      for (let k = 0; k < 3; k++) position[k] = p[i + k]!;
    });
    try {
      if (unknownVertex) throw Error("Unknown Manifold import vertex");
      if (
        restored.status() !== "NoError" ||
        restored.numTri() !== seed.numTri() ||
        restored.numVert() !== seed.numVert()
      )
        throw Error("Manifold double restoration changed topology");
      return restored;
    } catch (error) {
      restored.delete();
      throw error;
    }
  } finally {
    seed.delete();
  }
}
