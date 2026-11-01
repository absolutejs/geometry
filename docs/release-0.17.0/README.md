# Geometry 0.17.0 — queued, not published

The user requested an uninterrupted overnight pass and deferred all further npm confirmations until returning. Do not initiate publishing/authentication while that instruction stands. This candidate is prepared in the real package repository; the game remains on published 0.16.0 until release adoption is verified.

Changes:
- Native double import assigns unique triangle face IDs when callers omit them. A captured case has identical immediate import volume in 0.16 and the candidate, but its next cut differs in 0.16 by 3.84e-7 removed-volume / 1.16e-7 retained-volume relative to a native continuation. The candidate matches both reference volumes exactly. The current partition adapter already provided explicit IDs.
- `regularizeZeroExtentShells` certifies and removes only whole disconnected closed shells with exactly zero range on one coordinate axis. No epsilon, near-flat or volume threshold. Subnormal nonzero thickness is retained; rotated flat shells without a collapsed coordinate are retained. Output includes owned face-remapping certificates.
- `createManifoldCutSession` unions initial source meshes in one caller-chosen common frame, retains native intermediates, verifies ancestry, checks conservation and exposes owned snapshots plus bounded native/export counts. Failed cuts leave current state intact and release pending handles. Air strikes do not consume the accepted-cut budget. Explicit disposal is required.

90 package tests pass (31,690 assertions). A real GPU-disabled browser module worker checks exact import, four deformed partitions and native session splitting. Existing browser worker consumers also pass. The game research matrix passes 168/168 across eight variants, three shapes and seven cuts, plus 8,730 complementary plane queries. Maximum plane-volume discrepancy is 3.007e-12; 38 exactly zero-thickness shells are explicitly identified. The source-stamped matrix predates only additive snapshot diagnostic counters; release-archive verification follows below.

The same common-frame research using serialized intermediates still rejects four variant-4 cases because distinct doubles collapse on Float32 re-import. A native editing session is therefore the canonical direction; rendering snapshots are not promised as lossless session serialization.

Limitations: this is not world-rendering, collider, grain, canopy, material-strength or dynamic trajectory acceptance. The game integration is not yet delivered. Tool construction must supply a coherent common frame; the package does not guess one or snap nearly coincident planes. General regularized CSG and arbitrary mesh repair are outside this narrowly certified zero-extent cleanup.

Primary reference: [CGAL regularized solid operations](https://doc.cgal.org/6.0/Nef_3/index.html), checked 2026-10-31. Our implementation handles only exactly axis-collapsed disconnected closed shells; it is not CGAL's general regularization algorithm.

## Overnight bounds follow-up

The actual game integration exposed a remote air strike that needlessly entered native splitting. Exact disjoint/touching bounds now skip that operation, including after the accepted-cut budget is exhausted. Empty snapshots have an explicitly null tolerance. Three added regressions cover remote air strikes, empty material and exact command replay: 93 package tests / 31,703 assertions pass. A GPU-disabled browser worker confirms the skipped strike does not evaluate native geometry. The actual game physical pipeline (not only the research harness) passes 168/168 cases and 8,730 plane queries with unchanged source during the run. The release archive is regenerated after this fix; the earlier archive remains in git history and is superseded.

## Native coverage extension

The queued release now includes `auditManifoldCoverage` and read-only session
`auditCoverage`. Targets remain native; candidate cells are assigned to material
components and missing/excess union volumes are measured independently. Cavity
walls and nested positive islands retain their signed material meaning. Native
handles are bounded and disposed on failure; coverage does not imply convexity
or contact acceptance. The package suite now passes 101 tests / 31,746 assertions.
The GPU-disabled browser worker additionally checks half-cube session coverage
and a hollow cube with its cavity excluded. The game geometric-cell matrix passes
all 168 cases, with unchanged source throughout.

The earlier archive in this directory is superseded by this source extension.
The regenerated archive matches all 50 shipped dist files from an independent
build. See coverage-build-verification.json for exact hashes. No npm confirmation
should be requested while the user is away.

## Analytic positive pressure extension — archive refresh pending

The queued source additionally exports `prepareTrianglePositiveQuadraticMoments`.
It clips an affine scalar's positive region in barycentric space and integrates
its squared/cubed field and quadratic first moment. This replaces centroid-only
pressure sampling in the isolated game fluid research. Five targeted tests / 91
assertions cover clipped analytic integrals, thin positive regions, independent
six-point quadrature, translated/scaled geometry, ownership and invalid powers.
The coverage-era archive above is superseded; final suite/build/archive evidence
will be regenerated before this queued release is offered for publishing.

For each clipped subtriangle of area A and vertex values x,y,z, the quadratic
integral is A(x²+y²+z²+xy+yz+zx)/6 and cubic integral is
A(x³+y³+z³+x²(y+z)+y²(x+z)+z²(x+y)+xyz)/10. The quadratic first-moment
weight at the x vertex is A(3x²+y²+z²+2x(y+z)+yz)/30, with cyclic permutations
at the other vertices. These follow from barycentric monomial integration.
An independent positive degree-four rule is used only as a test oracle:
[FEniCS Basix quadrature source](https://github.com/FEniCS/basix/blob/main/cpp/basix/quadrature.cpp).

A pressure application point derived from these moments matches instantaneous
integrated force, torque and work for an affine normal velocity. A subsequent
finite-step rigid-body integrator still needs its own rate, ordering and energy
qualification; the geometry API does not certify those dynamics.

The analytic-pressure checkpoint passes the full 106-test suite (31,837
assertions) and the GPU-disabled browser worker, including a clipped pressure
integral and weighted application point. All 52 dist files match an independent
build and the refreshed archive. See positive-pressure-build-verification.json:
SHA1 3dd33af9f1e3e70a26ffa8fd1c7054bafbf34d89; SHA256
96361ed282f4b40cdaddc2be17caf5c4a802d0ecd30a751c6ef2282b1bed5bd2.
The archive is queued, not published.

## Waterline domain extension — current archive superseded pending refresh

The query's optional second affine field restricts the integration domain, allowing
water depth to clip the surface before pressure evaluation. Two new regressions
cover closed-form crossed half-planes, wholly dry regions, malformed domains and
additivity under four-way surface refinement. All seven targeted pressure tests
pass (160 assertions). The earlier analytic-only checkpoint remains in git history;
the latest exact archive will be regenerated after the coupled fluid qualification.

The waterline extension now passes the complete 108-test suite (31,906 assertions)
and the GPU-disabled browser-worker check. All 52 shipped dist files match the
independent build and refreshed archive. See waterline-build-verification.json.
Current archive SHA1: dbc43eb73612fbd7e06d1f12220075be4c5321cf; SHA256:
1755ce2cd7a326051b56522e020ab58c0000f4d86825e67ab0808a2c4571fb5d.
The prior analytic-only archive is superseded. This package remains unpublished;
the separate game still-water/current qualification is recorded by the game.

## Final scalar-query optimization checkpoint

The selected closed-solid query optimization preserves all 9,600 actual captured
volumes and first moments exactly while reducing paired CPU query time to 64.03%
of baseline. See docs/surface-query-2026-10-31 for the measured and rejected
alternatives. The full 108-test suite and GPU-disabled browser checks pass.
All 52 dist files match an independent build and the refreshed exact archive.
Current SHA1: a86e07eb5f13079e0a315ca662b4310ea8564e2e; SHA256:
bfa36c2b4dfb027c7bc0676ff1da457d7f70e43da54a6f2f7bff73d9bb3f75cc.
See scalar-query-build-verification.json. This supersedes the earlier waterline
archive; version 0.17.0 remains unpublished and requires no additional release.
