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
