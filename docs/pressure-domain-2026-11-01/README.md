# Full-domain polynomial integration fast path

When pressure values and optional wet-domain values retain an entire triangle,
reuse the same analytic polynomial integrator directly instead of building and
clipping temporary polygons. A zero wet field remains dry. Crossing fields use
the original clipping algorithm; public validation, owned results, finite and
underflow checks remain enforced. No sampling, cadence or material approximation.

The candidate includes the direct scalar plane-classification optimization from
87f0931. All 109 package tests / 31,939 assertions pass. A deterministic 100,000-
case comparison against the prior implementation, spanning geometry scales
1e-40..1e40 and field scales 1e-50..1e50, produces exactly equal output fields.
Alternating-order query timing was 117.80 ms versus 154.95 ms (ratio 0.7603).
This is a microbenchmark observation, not game FPS or total simulation speed.

GPU-disabled browser-worker checks pass exact native mesh import, cut sessions,
coverage/cavities, full/clipped pressure, cube full/partial/dry volume, and a thin
slab. Analytic first moments are compared in the documented returned reference
frame, not mistakenly as world-zero moments. Fresh native dynamics and timeout
recovery are still pending. No archive or npm release is replaced yet.
