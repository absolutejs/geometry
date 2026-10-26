export type IndexedMergeMesh = {
  numProp: number;
  vertProperties: Float32Array | Float64Array;
  triVerts: Uint32Array;
  mergeFromVert: Uint32Array;
  mergeToVert: Uint32Array;
};
type V = [number, number, number];
/** Export indexed geometry using explicit merge ancestry, never proximity welding. */
export function mergeIndexedMesh(
  mesh: IndexedMergeMesh,
  center: V,
  tolerance: number,
) {
  if (
    !mesh ||
    !Array.isArray(center) ||
    center.length !== 3 ||
    !center.every(Number.isFinite) ||
    !Number.isFinite(tolerance) ||
    tolerance < 0 ||
    tolerance > 1e-5 ||
    (!(mesh.vertProperties instanceof Float32Array) &&
      !(mesh.vertProperties instanceof Float64Array)) ||
    mesh.vertProperties.length % 3 ||
    !mesh.vertProperties.every(Number.isFinite) ||
    !(mesh.triVerts instanceof Uint32Array) ||
    mesh.triVerts.length % 3 ||
    !(mesh.mergeFromVert instanceof Uint32Array) ||
    !(mesh.mergeToVert instanceof Uint32Array) ||
    mesh.mergeFromVert.length !== mesh.mergeToVert.length ||
    mesh.mergeFromVert.length > mesh.vertProperties.length / 3 ||
    mesh.numProp !== 3 ||
    mesh.vertProperties.length > 300000 ||
    mesh.triVerts.length > 600000
  )
    throw Error("Unsupported finite cut output");
  const parent = Uint32Array.from(
    { length: mesh.vertProperties.length / 3 },
    (_, i) => i,
  );
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    while (i !== root) {
      const next = parent[i]!;
      parent[i] = root;
      i = next;
    }
    return root;
  };
  for (let i = 0; i < mesh.mergeFromVert.length; i++) {
    const a = mesh.mergeFromVert[i]!,
      b = mesh.mergeToVert[i]!;
    if (a >= parent.length || b >= parent.length)
      throw Error("Invalid finite cut merge map");
    const distance = Math.hypot(
      ...[0, 1, 2].map(
        (k) =>
          mesh.vertProperties[a * 3 + k]! - mesh.vertProperties[b * 3 + k]!,
      ),
    );
    if (distance > Math.max(tolerance, 1e-7))
      throw Error("Finite cut merge moved surface");
    parent[find(a)] = find(b);
  }
  const compact = new Map<number, number>(),
    p: number[] = [],
    indices = new Uint32Array(mesh.triVerts.length);
  for (let i = 0; i < indices.length; i++) {
    const raw = mesh.triVerts[i]!;
    if (raw >= parent.length) throw Error("Invalid finite cut vertex");
    const root = find(raw);
    let next = compact.get(root);
    if (next === undefined) {
      next = compact.size;
      compact.set(root, next);
      for (let k = 0; k < 3; k++) {
        const value = mesh.vertProperties[root * 3 + k]! + center[k]!;
        if (!Number.isFinite(value))
          throw Error("Invalid restored merge position");
        p.push(value);
      }
    }
    indices[i] = next;
  }
  return { positions: Float64Array.from(p), indices };
}
