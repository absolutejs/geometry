# Linear exposed-surface moments and exact empty domains

This research candidate extends the tested shared affine clipping integrator with
positive linear field/first moments. Existing quadratic/cubic queries retain
their API and direct full-domain path. The linear result intentionally has no
cubicIntegral property. It is geometry math, not contact/sealing inference.

Focused tests pass 15 tests / 6,354 assertions: independent strip integrals,
full/partial/thin domains, geometry and field scales, owned results, malformed
inputs, analytical free/sealed-bottom boxes including torque, and 1,000 exactly
opposed domains with nearby thin positive controls. The prior implementation
produced artificial nonzero linear integrals in 68/1,000 opposed examples. An
exact vertex-value identity now rejects that empty region, without a tolerance
cutoff or deleting genuine small geometry.

100,000 existing quadratic cases remain exactly equal to the previous optimized
implementation. Paired timings and exact dist hashes are in quadratic-comparison.
This is a small CPU comparison, not total simulation/FPS acceptance. The full package passes 116 tests / 38,100 assertions. GPU-disabled browser-worker checks pass the new linear field, exact opposed-domain and thin-positive-domain cases alongside native import/cut/coverage controls. Actual-tree static force/torque equivalence passes 504 poses with unchanged source; normalized errors remain below 1.4e-14. The preceding 8ffe844 candidate passed all 931 maintained game tests (7,590,492 assertions), with source unchanged. Archive checks and final-candidate dynamics remain pending.
The completed 56/56-case dynamics retest used the separate frozen pressure-domain
candidate; it is not evidence for this new API.

A follow-up guard rejects a nonzero relative first moment that underflows to zero
while its scalar integral remains representable. Both linear and quadratic paths
are covered by regression cases. This does not delete small geometry or widen any
zero/precision tolerance.

The final integration loop computes three weights once and preserves per-coordinate addition order. All 116 tests pass and 100,000 quadratic results remain exactly equal. The recorded paired timing ratio is 0.955 versus the pressure-only baseline, compared with 1.127 before this change. These subsecond measurements are noisy CPU microbenchmarks, not a sustained performance or FPS guarantee. Predecessor receipts are retained under the 8ffe844 prefix.
