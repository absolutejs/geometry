# Prepared solid plane query candidate

Unreleased addition after geometry 0.12.0. `prepareSolidPlaneMoments` accepts a
valid exclusive oriented indexed material mesh and explicit per-triangle owners.
Existing `solidComponents` preserves cavity ownership; preparation owns coordinates
and caches complete component moments. Plane/AABB interval classification skips
dry components and reuses full moments for wholly wet components. Ambiguous
bounds use the existing prepared tetrahedron integrator. Rebuild after edits.

The query returns volume, fullVolume, fraction, firstMoment relative to reference,
centroid, and work counters. Volume and moments retain signed tetra contributions;
there is no per-tetra absolute value or silent output clamp. Relative fraction
roundoff up to 1e-10 is accepted; a nonpositive residual volume has no centroid.
This is floating-point geometric integration, not exact predicates. The helper
validates closed material components but does not certify that distinct owners
are mutually exclusive or infer fluid exposure, sealed air, drag or contact.

Current qualification: 70 package tests plus one independent native-cut test
pass. The native test checks 160 arbitrary planes through a cavity-bearing cube,
including pressure-relevant first moments from its independently clipped/capped
native boundary. Tests cover analytic cavities, disjoint components, ownership,
plane complements, boundary offsets, normal magnitudes 1e-200 through 1e200,
scales 1e-40 through 1e40 and translations.

The game candidate passes 3,200 captured poses (45.84% fewer exact queries) and
5,496 boundary cases. Maximum normalized captured-pose volume difference is
3.035e-12, first-moment difference 1.835e-12. Full dynamic qualification is in
progress. The installed game stays on published 0.12.0; candidate comparisons
use an explicit GEOMETRY_MODULE entry, not a dependency patch. No graphics checks
have been run after the host-crash recovery.
