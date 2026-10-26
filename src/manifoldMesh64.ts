import type { Manifold } from "manifold-3d";

/** Read native double positions through an integer property sidecar. The public
 * getMesh() position buffer is Float32; it may collapse thin triangles even after
 * rebasing. No geometry edit, simplification or proximity welding is performed.
 * Extra properties retain getMesh's native export semantics/precision.
 * Returned arrays are owned copies; caller still owns the input solid. */
export function getManifoldMesh64(solid: Manifold) {
  const triangles = solid.numTri(),
    properties = solid.numProp();
  if (
    !Number.isSafeInteger(triangles) ||
    triangles < 0 ||
    triangles > 200000 ||
    !Number.isSafeInteger(properties) ||
    properties < 0 ||
    properties > 16 ||
    solid.numVert() > 100000
  )
    throw Error("Manifold double export budget exceeded");
  const limit = triangles * 3;
  const positions = new Float64Array(limit * 3);
  let count = 0;
  const tagged = solid.setProperties(
    properties + 1,
    (next, position, previous) => {
      if (
        count >= limit ||
        position.length !== 3 ||
        !position.every(Number.isFinite)
      )
        throw Error("Invalid native double position callback");
      positions.set(position, count * 3);
      for (let i = 0; i < properties; i++) next[i] = previous[i]!;
      next[properties] = count++;
    },
  );
  try {
    if (tagged.status() !== "NoError")
      throw Error("Invalid native double export");
    const mesh = tagged.getMesh(),
      stride = properties + 3;
    if (
      mesh.numProp !== stride + 1 ||
      mesh.numVert > 100000 ||
      mesh.triVerts.length !== triangles * 3 ||
      mesh.faceID.length !== triangles ||
      mesh.mergeFromVert.length !== mesh.mergeToVert.length ||
      mesh.runIndex.length !== mesh.runOriginalID.length + 1
    )
      throw Error("Invalid native double export metadata");
    const vertProperties = new Float64Array(mesh.numVert * stride);
    for (let i = 0; i < mesh.numVert; i++) {
      const id = mesh.vertProperties[i * mesh.numProp + stride]!;
      if (!Number.isSafeInteger(id) || id < 0 || id >= count)
        throw Error("Invalid native position sidecar");
      vertProperties.set(positions.subarray(id * 3, id * 3 + 3), i * stride);
      for (let p = 3; p < stride; p++) {
        const value = mesh.vertProperties[i * mesh.numProp + p]!;
        if (!Number.isFinite(value)) throw Error("Nonfinite native property");
        vertProperties[i * stride + p] = value;
      }
    }
    return {
      numProp: stride,
      vertProperties,
      triVerts: mesh.triVerts.slice(),
      mergeFromVert: mesh.mergeFromVert.slice(),
      mergeToVert: mesh.mergeToVert.slice(),
      faceID: mesh.faceID.slice(),
      runIndex: mesh.runIndex.slice(),
      runOriginalID: mesh.runOriginalID.slice(),
      reversed: Uint8Array.from(mesh.runOriginalID, (_, run) =>
        mesh.backside(run) ? 1 : 0,
      ),
    };
  } finally {
    tagged.delete();
  }
}
