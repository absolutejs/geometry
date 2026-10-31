# Geometry 0.14.0 release qualification

Partial solid-plane queries use clipped boundary area and first moments. Existing full/dry component gates, closed topology, owner/cavity semantics and volume validation remain. The first-order triangle implementation shares clipping logic with the existing second-order API; no native engine changed.

72 tests pass (30,522 assertions), including 160 independent native solid cuts and the new thin slab / distant tangential plane-point regression. The initial projection origin lost relative accuracy at a 1e-12 slab depth; reanchoring the dominant normal coordinate fixes it. Independent TypeScript builds match all 38 output files. All 41 archive files match source/build files; extracted-archive import and a tetrahedral solid query pass. GPU-disabled browser worker checks pass; no native GPU or WebGL test was launched.

The game completes six 20-second 480 Hz native runs (57,600 steps) on this exact implementation with maximum normalized energy drift 1.2171e-5. Tree variants 2/3 remain rejected by pre-existing material ancestry checks; this release does not repair those failures. The game remains on registry 0.13.0.

Initial timings were mixed. The final cached first-order path passes a paired alternating benchmark on 12 components: median runtime ratios 0.530–0.667 (33–47% lower measured CPU time). All 660 volume/first-moment comparisons pass. This is local CPU evidence, not a universal speed or GPU FPS guarantee. The final cache-only optimization reproduces all 240 sampled poses from the first two seconds of the six prior twenty-second candidate runs exactly. No native or collision behavior changed. Exact archive SHA1: 32a9ab3921290bb7b78bb94375afe4683890321a.
