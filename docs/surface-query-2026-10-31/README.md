# Closed-solid query cost

The coupled game-fluid audit identified hydrostatic surface work as a substantial
CPU cost. Two real package experiments were compared against 9,600 actual captured
poses across all 24 branch variants/shapes. Every displaced volume and first
moment matched the reference exactly; game source was unchanged during both runs.

The first attempt cached full-triangle results behind conservative face AABB
classification. It preserved all moments and reduced triangle-query calls, but
total paired query time was 95.86% of baseline with inconsistent per-case gains.
That attempt is retained only as artifacts/surface-culling/bounds-attempt.patch
and bounds-* evidence; it is not the shipped implementation.

The selected change validates/normalizes the plane once in the public closed-solid
query, uses a private validated-plane triangle path, and avoids temporary vectors
in plane-distance and boundary-flux arithmetic. Public triangle validation,
ownership, clipping, precision guards and summation order remain intact. The same
9,600 captured queries match every volume and first moment exactly. Paired query
time was 11,214.8 ms vs 17,515.9 ms (64.03%). These are CPU query timings alongside
other qualification work, not hardware FPS or a production frame-budget promise.

The complete 108-test package suite passes (31,906 assertions), including thin
slabs, large tangential plane offsets, translated/scaled geometry and cavities.
The optimization is folded into the still-unpublished 0.17.0 candidate; it does
not require a second publication prompt. Earlier archives are historical
checkpoints and will be superseded by the final exact archive.
