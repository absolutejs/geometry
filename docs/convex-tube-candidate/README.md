# Convex authored tube closure candidate

The game's existing cap helper closes each convex boundary ring by introducing an averaged center vertex. Captured forest-v8 variants 2/3 fail strict surface ancestry during material partitioning on triangles incident to that generated center. Importing original doubles does not repair both cases; validating only the final union also leaves one rejected.

The `cap-probe` retriangulates each cap from its original boundary vertices, preserving directed boundary winding and removing the generated center. Both captured partitions then pass the existing topology, volume and ancestry checks. No tolerance or winding gate changes. This changes the piecewise planar cap approximation for slightly nonplanar imported rings; it is not claimed to preserve every triangle or all Boolean subdivisions exactly. Original bark vertices remain unchanged. Tests bound the volume difference.

Candidate `closeConvexTube` moves the actual game helper into the reusable geometry package and uses boundary-only fans. Its scope remains deliberately bounded: two planar convex rings, <=64 vertices per ring, local coordinates <=1000, a 1e-6 seam-weld grid, and maximum plane residual 1e-5. It is not an arbitrary polygon/cavity or fracture repair routine. Cap UV coordinates still use the geometric ring center; the cap triangles no longer require a center vertex.

The game still uses the published existing helper. `geometry-cap-candidate-preload.ts` is qualification-only: it routes the helper import to the real candidate package without changing production source or node_modules. Adoption will use the published package, remove the local implementation and update the old center-vertex-specific UV assertion.
