# Linear exposed-surface moments and exact empty domains

This research candidate extends the tested shared affine clipping integrator with
positive linear field/first moments. Existing quadratic/cubic queries retain
their API and direct full-domain path. The linear result intentionally has no
cubicIntegral property. It is geometry math, not contact/sealing inference.

Focused tests pass 14 tests / 6,352 assertions: independent strip integrals,
full/partial/thin domains, geometry and field scales, owned results, malformed
inputs, analytical free/sealed-bottom boxes including torque, and 1,000 exactly
opposed domains with nearby thin positive controls. The prior implementation
produced artificial nonzero linear integrals in 68/1,000 opposed examples. An
exact vertex-value identity now rejects that empty region, without a tolerance
cutoff or deleting genuine small geometry.

100,000 existing quadratic cases remain exactly equal to the previous optimized
implementation. Paired timings and exact dist hashes are in quadratic-comparison.
This is a small CPU comparison, not total simulation/FPS acceptance. Full package,
browser, native-tree surface/volume equivalence and archive gates are pending.
The active 56-case dynamics retest still uses the separate frozen pressure-domain
candidate; it is not evidence for this new API.
