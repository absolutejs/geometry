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
