# Prepared upward surface query — geometry 0.18.0

Adds `prepareUpwardSurface` to the real package for repeated mesh-height and slope
queries. Its bounded XZ grid is prepared once and owns coefficients, enabling
repeated footprint probes without scanning the whole mesh. It distinguishes
missing coverage from a floor and excludes downward ceilings. See the public
README for limits, edge tolerance and coordinate-frame semantics.

All 56 existing implementation/declaration files match the game's installed
published 0.17.0 byte-for-byte. The index adds exports and two new files implement
the query. No native kernel or prior geometry operation changes.

Qualification:

- 133 tests / 73,487 assertions pass, including new slope, signed-grid boundary,
  translated-coordinate, stacked-floor/ceiling, deterministic tie, transfer,
  budget, degenerate-face and nonfinite-arithmetic checks.
- A 1,024-face fixture requires one triangle visit per sample; reported counts
  are actual indexed visits, not a hardware performance estimate.
- Two independent frozen-lockfile builds match all 60 shipped JS/declaration
  files. `independent-build.json` records their hashes.
- The exact packed archive installs into an isolated consumer with all 60 files
  matching the build. Its checksum/integrity match npm pack metadata.
- `archive-browser.json` qualifies that installed archive in a real browser
  module worker: inputs transfer in, originals transfer back out, subsequent
  queries still work, and failed preparation does not replace the prior query.
  No GPU context is created; bounded browser deadline is 30 seconds.
- The initial built-source browser check is retained separately. The final archive
  check is authoritative for the final source and build.

Game candidate comparison (recorded in hello-world/docs/upward-support-2026-11-02)
checks 12 generated-terrain cases across three sites, excavation on/off and 2m/4m
mesh resolution. Retained placement identities match the existing worker, with
only double-precision arithmetic differences. Separate ledge controls distinguish
an actual missing support face from an unloaded neighboring chunk, including a
negative-coordinate chunk boundary. This is not a complete rock stability policy.

## Delivery status

Tested source and exact archive are pushed at `d426950`. Publisher login and
publication confirmation completed, and npm accepted publication. Registry
integrity and shasum now match the exact tested archive; publication is verified. The game has installed published 0.18.0 and is qualifying its production adapter. No file dependency
or installed dependency patch is being shipped as a substitute.

Reproduce with BVM Bun 1.4.4+absolute.1:

```sh
bun install --frozen-lockfile
bun run check:package
timeout 45s bun scripts/check-upward-support.cjs
```

Set `SUPPORT_DIST` to the installed archive's dist directory and `SUPPORT_OUT` to a
fresh JSON path to repeat archive-browser qualification. Independent/consumer
node_modules and build caches are ignored; source, exact archive and selected
release evidence are durable repository files.
