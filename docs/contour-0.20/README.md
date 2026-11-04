# Scalar-contour distance release qualification

0.20.0 adds bounded sign-change extraction and spatially accelerated nearest
segment queries. Source samples are borrowed only during preparation; results
own their buffers. Queries use local coordinates and finite radii, reject missing
domains, and never claim exact distance to the continuous underlying field.

147 package tests pass; straight subcell shores, curved convergence, independent
exhaustive queries, saddle/zero handling, extreme finite values, finite radius,
input mutation, budget failures and overlapping tile halos are covered. A real
browser worker imports built code and successfully queries transferred input.
Independent TypeScript builds match all 64 shipped files. Exact npm archive
consumer passes. An initial archive assertion used decimal bit equality for .2
and failed on normal floating-point rounding; corrected to 1e-14 tolerance.
An initial npm pack attempt could not write the default read-only cache; a local
cache succeeded and was removed. No GPU work or runtime speed claim.

The package does not construct a full signed texture or infer inside/outside;
consumers must combine metric queries with authoritative membership and maintain
halo, revision, material and error contracts. Plateaus and unresolved topology
remain explicit limitations. Only one release archive retained pending publish.
