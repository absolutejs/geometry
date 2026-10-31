# Geometry 0.13.0: prepared material-solid plane cuts

Adds a reusable component-aware query that avoids per-triangle clipping for
wholly wet/dry closed material components. The existing tetrahedron and triangle
integrators are unchanged. Bounds near a plane fall back conservatively; cavity
ownership and signed contributions are preserved. The README specifies input
validity, floating-point limits and result/reference semantics.

Qualification: 71 package tests, 30,432 assertions. Analytic cavities, disjoint
solids, mutation ownership, normal scaling, coordinate scaling/translation,
complements, boundary planes and invalid inputs pass. An independent native
Boolean clipping oracle checks volume and first moments on 160 arbitrary planes
through a cavity-bearing solid. GPU-disabled Chrome verifies transferable typed
inputs, partial/full/dry worker queries, and the existing public API checks.
No WebGL scene or GPU benchmark is involved in that browser qualification.

The game candidate passes 3,200 captured cut-limb poses and 5,496 boundary cases.
Captured-pose clipping calls decrease 45.84%, with maximum normalized volume
and first-moment differences 3.035e-12 and 1.835e-12. One-component limbs that
stay partially wet show slight overhead; this is not a universal speedup.

Eight twenty-second native cut-limb simulations at 480 Hz pass (76,800 steps).
Maximum energy error is 2.296e-5 of characteristic gravitational energy. Every
run records the same candidate implementation SHA256. Timings are CPU evidence,
not hardware FPS or a live-world body budget. These tests do not resolve the
previously documented sensitivity of undamped long trajectories or add drag,
waves, flooding or fluid reaction. Game evidence lives in its repository.

Publication and archive qualification are recorded below when complete. The game
remains on published 0.12.0 until registry verification and dependency adoption.
