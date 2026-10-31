# Native material coverage — queued 0.17 extension

This is source work for the unpublished 0.17.0 candidate. The earlier archive in docs/release-0.17.0 is superseded only after the next complete archive qualification; do not publish it as this extended API. The user deferred npm authentication until returning.

`auditManifoldCoverage(wasm, target, candidates)` measures missing and excess material independently, preserving target native geometry across all operations. `session.auditCoverage(candidates)` runs that read-only audit against the current native cut state without consuming a cut or returning borrowed native handles. Both return owned geometry/measurement data. Caller-owned target handles remain alive and unchanged; all temporary native objects are released on success and failure.

The full oriented target boundary is regularized only by the existing exact zero-coordinate-extent certificate and grouped by `solidComponents`. Native shell decomposition is matched to those groups by exact triangle coordinate sets. A single exterior shell is copied natively. For bodies with cavities, intersect the original material with the exterior shell and exclude smaller nested positive shells belonging to other bodies. This preserves hollow bodies and nested islands without rebuilding generated geometry through Float32.

The pinned Manifold 3.5.1 JS `compose` path performs a Boolean union. A 2×2×2 box minus an inner unit box has volume seven, decomposes into shells of signed volumes eight and minus one, but `compose` yields volume eight and fills the cavity. A regression exposed this; the implementation does not use compose for cavity assembly. The local pinned .d.ts describes compose as lazy union/deprecated, so the inverse-decomposition wording must not be read as a guarantee for oriented cavity shells.

Limits: 128 candidate meshes, 100,000 aggregate candidate vertices, 200,000 aggregate candidate triangles, 32 target material components and 128 native shells. Coordinates must be finite and within 1,000 units. Shared candidate storage is rejected. Native outputs are bounded. Negative native query volume is accepted as zero only if exact zero-extent regularization removes the whole result; otherwise it fails explicitly. No epsilon regularization is added.

Cells are assigned by the largest measured intersection; cross-component and outside-assigned volume remain separate outputs, so a bridge cannot masquerade as nearest-center ownership. Component coverage uses the union of assigned cells, not their summed volume. This API does not certify candidate convexity, contact behavior, density or game acceptance thresholds. `nativeBooleanQueries` counts Boolean calls issued, not internal solver iterations.

Initial qualification: 101 package tests pass, including equal-volume displaced cells (both missing/excess detected), overlapping cells, a bridge between bodies, cavity exclusion, nested positive islands with their own cavities, failed handle-copy cleanup, empty material and read-only session failure recovery. The actual game package probe passes all 24 full-cut tree/shape cases and exact native/rendered triangle correspondence. Expansion across all seven cut stages and browser/archive checks follow before the archive is refreshed.

The real GPU-disabled browser worker also passes session coverage and a hollow
cube test. Browser evidence is in the release qualification log. The game checks
all 168 variant/shape/cut combinations against this exported API; actual Rapier
hull preparation is a separate subsequent gate, not implied by these probes.
