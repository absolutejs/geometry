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
