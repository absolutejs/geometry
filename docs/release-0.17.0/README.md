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
