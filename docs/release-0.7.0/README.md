# Geometry0.7.0 — native double-position export

BVM Bun1.4.4+absolute.1. Build and41 tests /14697 assertions pass. Built Node
ESM/transfer consumer, native partition consumer, GPU-disabled browser core worker
and optional Manifold-module import checks pass. Browser smoke does not initialize
Manifold; native execution is covered by CPU Node/Bun checks and game candidates.

The public native Mesh export is Float32. Even centering an entire solid cannot
preserve triangles much smaller than its full extent. getManifoldMesh64 captures
native double positions through setProperties and uses an exact integer property
sidecar to recover them after getMesh. The extra native copy is released. Original
face IDs, Boolean backside metadata and custom properties remain available. Normal
property tests compare transformed native normals. A translated10nm cube whose
ordinary exported positions collapse completely retains native bounds/volume.
Input construction remains native Float32; this does not fix prior import loss.

The optional partition adapter uses this exporter; mergeIndexedMesh accepts either
float width while preserving explicit merge maps. No geometry simplification,
tolerance widening, vertex proximity welding or rendering-loop change was added.

Hello World's source partition fixtures and8 physical-cut sequences pass with a
candidate-only bundler alias to this built adapter. Source/receipts are in the game
at docs/material-provenance-2026-10-26/*double-candidate*. This does not change its
installed dependency until registry publication. Newly attempted ownership-aware
cut-cell reunion still fails strict ancestry/internal-wall checks; it is not part
of this release and is not claimed to be fixed by export precision alone.

Primary API references checked2026-10-26:
- https://manifoldcad.org/docs/jsapi/classes/manifold.Manifold.html#setProperties
- https://manifoldcad.org/docs/jsapi/classes/manifold.Mesh.html
The bounded sidecar implementation is our inference from the documented callback
and export contracts, qualified by executable fixtures rather than assumed.
