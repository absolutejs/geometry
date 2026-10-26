# Canonical canopy coverage audit — 2026-10-26

CPU-only projection of actual Hello World forest-v8 GLB triangles and embedded
leaf alpha. No native GPU was opened. These masks are measurements of existing
assets, not generated artwork. Black is outside the hull; colors distinguish
open and covered samples (see audit script).

Bun: 1.4.4+absolute.1. Source SHA-256:
`098c099d75aa0b62905988bbc354143dc33e263789792a27731ba5715e4a33ff`.

All eight canonical variants and four transformed cases were sampled at 128,
256 and 512. The 256→512 maximum gap change was 0.001306;
maximum relative covered-area change was 0.002215.
Acceptance gates were 0.02 absolute gap and 0.05 relative area. All passed.
Timings are single CPU observations, not stable benchmarks or GPU FPS.

| Variant | Pose | Gap fraction (512) | Covered area m² | CPU ms |
| --- | --- | ---: | ---: | ---: |
| 0 | canonical | 0.3832 | 30.978 | 218.1 |
| 0 | phenotype | 0.3626 | 44.721 | 181.4 |
| 0 | fallen | 0.4103 | 40.713 | 300.3 |
| 1 | canonical | 0.4068 | 30.495 | 179.3 |
| 2 | canonical | 0.3439 | 32.439 | 84.5 |
| 3 | canonical | 0.3485 | 33.372 | 87.3 |
| 4 | canonical | 0.3664 | 63.622 | 80.5 |
| 4 | phenotype | 0.3635 | 98.374 | 75.4 |
| 4 | fallen | 0.4292 | 49.679 | 72.7 |
| 5 | canonical | 0.3685 | 64.106 | 218.6 |
| 6 | canonical | 0.3240 | 48.904 | 83.8 |
| 7 | canonical | 0.3055 | 49.630 | 86.2 |

The assumed 0.25 gap in the existing experimental water probe is not a measured
asset property. These results support replacing that assumption with on-demand
worker measurements of the actual current pose. They do not calibrate reservoir
capacity, retention, evaporation or drainage. Do not feed this single-tree mask
into rainfall suppression until overlapping canopies and throughfall are handled.

Reproduce from the package root with `bun scripts/audit-game-canopies.ts`.
`HELLO_WORLD_ROOT` selects the game checkout. The audit currently uses that
checkout's forest geometry helper and an existing Playwright PNG decoder; it is
development evidence, not part of the published runtime or portable CI tests.
The JSON records source hashes, texture hashes, work counters and all resolutions.
