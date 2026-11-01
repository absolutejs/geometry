# Hierarchical boundary flux — candidate investigation

The queued 0.17.0 archive at fcd1675 remains unchanged. This branch is an isolated
optimization candidate, not a new release or a verified replacement. Initial
package checks pass 110 tests / 32,815 assertions. Captured-pose and dynamic
qualification are pending; no FPS or production body-budget claim is made.

## Why group faces

A partially immersed closed component previously queried every surface triangle.
The candidate builds a balanced hierarchy over face bounds, with 16-face leaves.
A conservative plane interval skips wholly dry nodes, evaluates cached oriented
surface integrals for wholly wet nodes, and clips faces only in crossing leaves.
Components with at most 64 faces retain the direct path. Plane margins retain
exact triangle queries around uncertain boundary classifications.

The cache is **not** a volume assigned to an open patch. It stores boundary flux
coefficients, preserving orientation and cavity faces. For a node-local origin
`r`, write `y=x-r`, and cache:

- `S = integral(n dA)`
- `B = integral(y dot n dA)`
- `C[i,j] = integral(y_i n_j dA)`
- `D[i] = integral(y_i (y dot n) dA)`

For the existing flux origin `o` on the clipping plane, let `d=r-o` and
`F=B+d dot S`. The node contributes volume `F/3` and first moment about the
mesh reference `o*(F/3) + (D+C*d+d*F)/4`. These follow by expanding the same
boundary-flux integrals used by the direct path. The clipping cap contributes
zero flux because `o` lies in its plane. Grouping changes summation order; it
must be qualified numerically rather than claimed bit-identical.

## Tests and pending gates

The new open-patch test compares 200 oblique planes across 384 independently
oriented triangles against the direct face path. The refined-solid tests exercise
768-face cubes, depth down to 1e-12, scales 1e-40 through 1e40, complements and a
refined cavity. Existing independent native-cut tests and the full suite pass.

Next: 9,600 actual captured branch poses, with normalized volume and first-moment
differences below a predeclared 1e-9; preserve all measurements. Then actual native
trajectories, CPU measurements and browser/independent archive qualification if
results justify adoption. The reference package and current long game audit are
not modified while this work proceeds.

A GPU-disabled browser-worker extension is prepared for a 768-triangle refined
cube, checking actual hierarchy use, half-volume/centroid and a thin slab. It
will run after the current sequential game audit; syntax validation alone is
not recorded as browser qualification.

## Recorded performance decision

All three hierarchy variants pass the 9,600 captured-pose accuracy gate (errors
on the order of 1e-15 normalized), but none justifies adoption yet. Sequential
paired CPU-time ratios versus the direct path were 0.9323 for the original
16-face tree, 0.9898 for four-face centroid-spread groups, and 0.9451 after
removing traversal temporary arrays. These are single paired observations, not
hardware-FPS evidence. Small components sometimes regress. The four-face
attempts are preserved as patches; source here returns to the original tested
prototype. Game receipts are on research/float-contact under
`docs/hydrostatic-hierarchy-2026-11-01/`. The canonical queued archive is unchanged.

Next investigation removes allocation from the direct triangle classification
path instead of paying hierarchy traversal overhead. It lives in the separate
`research/scalar-plane` branch; this hierarchy is not silently shipped.
