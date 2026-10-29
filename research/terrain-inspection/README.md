# Bounded terrain inspection research

Not exported or released. Game 0.18.0 is delivered independently. Its finite-cut
path correctly rejects terrain meshes without an independent clearance check.
The retained terrain patch has one outer rectangular boundary and otherwise
clean exact-coordinate topology. This prototype adds an owned inspection
closure below the source surface without changing its positions or triangles.
It does not repair or weld input, or certify arbitrary self-intersections.
Only a single rectangular projected boundary with positive axial orientation is
supported. Vertical/doubled projections, holes, wrong orientation, degenerate or
nonmanifold topology, invalid planes and exhausted budgets reject explicitly.
Synthetic faces retain a distinct triangle range so future distance queries can
return unknown when their closest witness is not original material.

Source facts and measured failures: hello-world/docs/finite-terrain-expansion-2026-10-29/.
Further geometry/cavity oracles and measured query performance are required
before release or game activation. No PAAS edits or native GPU use.

The first closure prototype passes seven tests (58 assertions) and builds.
Tests cover all three projection axes, analytic sloped volume, an interior
depression, large translation, a thin footprint, malformed topology and the
retained 8,234-triangle terrain mesh. Its original triangle coordinates remain
unchanged, and the 258 boundary edges add 774 explicitly synthetic faces.
Closed-boundary membership agrees with the tested inside/outside control points.
This does not yet qualify a signed nearest-point query or a game clearance gate.

The owned signed-witness prototype builds and passes four initial tests. It
requires a true nearest witness with exact triangle identity from an external
accelerator; it does not claim to find the nearest point itself. It precomputes
angle-weighted vertex normals and adjacent-face edge normals. Near uncertain
features it requires sign agreement, and synthetic boundaries remain unknown.
The source must be an outward non-self-intersecting boundary: topology and
finite positive volume are checked; arbitrary self-intersection is not certified.

The captured-patch probe reuses installed three-mesh-bvh 0.8.3 / Three 0.186.1
with indirect indexing and zero early-exit threshold. Across 574 deterministic
points (1 mm offsets from original faces plus seeded volume samples), every
known result matches the independent solid-angle membership oracle. Twenty-four
queries correctly remain unknown because their closest feature is synthetic.
One cold observation: build 239 ms, queries 86 ms, full winding oracle 5,025 ms.
These are cold bounded CPU observations, not FPS or universal speedup claims.
Source hashes and all points/witnesses are retained in witness-probe.json.

Method background: https://libigl.github.io/tutorial/#signed-distance and the
installed three-mesh-bvh README closestPointToPoint/indirect-index contracts.
The closure/witness helpers remain unexported and unreleased. Actual trajectory
checks, broader shape controls and measured warm cost are still required.

## Recorded trajectory and bounded cache (2026-10-29)

The retained 1920 Hz non-settling fixture contributes 438,256 recorded proxy
vertex positions. Full nearest queries produced no unknowns, sign-oracle
mismatches, brute-force nearest-distance mismatches or lower-bound violations.
The minimum signed distance was -0.00002240833637617656 m. This is endpoint
proxy-vertex evidence, not continuous motion or whole authored-material proof.
The failing sleep result remains a failure; no poses or solver states changed.

`trajectory-reference.json` and its hashed little-endian float64 gzip preserve
all full-query distances. The tracked probe validates the exact point sequence
and both reference hashes before comparing every returned bound. With 1e-7 m
padding, it makes 7,879 oracle queries and propagates 430,377 conservative
positive bounds, with zero unknowns or violations. The minimum bound is the
reference minimum minus padding. A static signed distance is 1-Lipschitz, so
subtracting point displacement preserves a lower bound; only positive remaining
bounds skip queries. Geometry changes require reset. A domain callback runs on
every sample, before cache propagation; rejection or callback failure clears
that point. Caller and callback tuples cannot alias retained state.

`domain-tracked-trajectory.json` records the bounded patch domain and selected
source hashes. Its cold observed build/loop times were 106/257 ms, not a hardware
FPS benchmark. Previous observations, failed tests and the initial tuple type
error remain recorded rather than silently overwritten.

Exact edge/vertex witnesses now use their feature pseudonormal instead of an
irrelevant tangential face normal. A regression first reproduced the ambiguous
result; edge/vertex and nested cavity controls now pass. All 66 package tests
(30,815 assertions) and the TypeScript build pass in domain-all-tests.log and
domain-build.log. New helpers are still unexported and unreleased. Broader
terrain validation and coverage semantics are required before a game gate can
use them. No dependency adoption or finite-drop gate changes are included.

## Wider terrain and surface coverage

`generate-patches.ts` reuses canonical game generation at three reported sites,
with no excavation and radii 2.5/8 m. All nine patches support inspection closure.
Their 5,166 nearest-witness samples have zero known sign disagreements against
the winding oracle. Synthetic-boundary queries remain unknown (638 total).
Source hashes, compressed exact patches, all witnesses and logs are retained
under patches/. This is sampled evidence, not self-intersection certification.

The new unexported `auditDistanceTriangles` addresses the vertex-only blind spot:
a triangle's centroid distance minus its enclosing radius is a lower bound over
its entire surface for a static 1-Lipschitz signed-distance oracle. Ambiguous
triangles split along their longest edge. Known oracle uncertainty and explicit
arithmetic padding are deducted; penetration requires the upper distance bound
also to fail. Unknown oracle results and depth/query exhaustion stay unknown.
It owns the input arrays and shields points from callback mutation. Five tests
cover a sphere intersecting a face while all vertices clear, analytic plane
subdivision, uncertainty/budget failures, malformed input and alias isolation.
All 71 package tests (30,829 assertions) and the build pass.

`probe-terminal-surfaces.ts` reconstructs convex hulls of the saved source
points with installed Three's double-precision ConvexHull (not Float32
ConvexGeometry). This is NOT a native hull export. At 5 mm tolerance the initial
20,000-query-per-hull cap clears 18 of 19 terminal-pose surfaces and leaves one
explicit query-budget unknown. A diagnostic 100,000 cap clears all 19 with
61,296 total queries (42,316 for that large hull); cold observed loop cost is
609 ms. Both results remain saved. No production budget or acceptance tolerance
was changed, and the original non-settling physics attempt still fails.

This expensive surface-only prototype is not ready for runtime adoption. It
does not establish continuous-time clearance, exclude a fully enclosed obstacle,
or prove that reconstructed hulls equal native collision shapes. Next work must
address actual native-hull coverage and acceleration before promoting a finite
terrain gate. These findings are a reason to preserve the gate, not bypass it.

The published Rapier 0.18.0 export control also clears 19/19 terminal surfaces
with 61,286 queries (572 ms cold observed). It uses the canonical game's
woodColliderShape construction and frees every collider/world. Crucially,
`vertices()`/`indices()` normalize convex meshes by recomputing a hull: they do
not expose the exact stored native topology. Five hulls export fewer vertices
than their source points. Export hashes and counts are retained in
normalized-native-surfaces.json. This validates a second reconstruction path,
not permission to claim exact solver-surface coverage. No new engine release
is needed for these existing APIs, and no engine source was changed.
