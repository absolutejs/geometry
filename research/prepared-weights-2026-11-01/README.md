# Prepared source-face interpolation

The game profile identified repeated static source-face projection work in bark attribute mapping. The new prepareTriangleWeights owns its source parameters and reuses the dominant-plane projection. The one-shot API uses the same implementation; nonrepresentable geometry/query arithmetic now rejects instead of returning NaN. Existing plane-distance and outside-face gates are unchanged.

All 126 package tests / 71,478 assertions pass. A GPU-disabled browser worker verifies prepared results after source-array mutation, alongside native/domain consumers. The independent frozen-implementation comparison matches 100,000 valid point queries exactly for both prepared and one-shot calls. All loaded comparison artifacts are hashed before/after. Five warm paired CPU samples give medians 67.816 ms baseline, 54.145 ms new one-shot and 13.276 ms prepared for 100,000 queries. These are local Bun observations, not browser FPS acceptance.

The game independently compares every render attribute buffer and bounding sphere across 168 actual cut cases: 432 material pieces, 4,320 buffers and 36,590,796 bytes match exactly. Both renderer variants in that comparison load the new math, while the separate 100,000-query test checks the old implementation. Whole-preparation warm medians move from 11.095 to 10.205 ms in separate exploratory runs, but maximums remain high. Off-thread preparation still needs investigation.

This research does not supersede the queued exact 0.17 archive until independent builds, final game regression and refreshed archive qualification finish. No npm authentication is requested.
