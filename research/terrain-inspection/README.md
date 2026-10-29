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
