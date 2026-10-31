# Physical wood input precision reduction

Captured inputs from the game's forest-v8 branch 15, variants 2/3. These are model geometry, not user telemetry. Reproduce from package root with `bun artifacts/import-precision/probe.ts` and `bun artifacts/import-precision/union-probe.ts`.

Published geometry 0.13 rejects both partitions on surface-origin winding. Restoring Float64 input positions through native warp also rejects both: import precision alone is not a complete explanation or fix. Warp experiment is diagnostic only and not a production adapter change.

Skipping exclusive cells and validating only the union exterior still rejects variant 2; variant 3's exterior passes. Therefore skipping internal partition validation is not a general repair. No winding gate, welding tolerance or ancestry requirement was relaxed. The error payloads retain original/output triangles and provenance for reduction.
