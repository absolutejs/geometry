# Geometry 0.1.0 release — 2026-10-26

Published `@absolutejs/geometry@0.1.0` after interactive npm authentication and
publish confirmation. Registry processing initially returned 404, then exposed
0.1.0; the Hello World consumer subsequently installed the exact registry release.
No source patches or local file dependency were used for adoption.

Published tarball SHA-1: `7b28b6493f796a11ea74f2e840ed2acd47b24625`.
Runtime is dependency-free ESM with declaration files; tarball contains seven
files / 18.68 kB unpacked. Built ESM import and Node transferable worker passed.
A real Chromium module-worker test passed with GPU disabled. Focused tests:
8 passing, 12,333 assertions, including an independent randomized point-in-
triangle oracle. Real tree asset convergence evidence is in ../canopy-audit.

Upstream CI passed at `800184d2f1c9f081037867711c4a25f2a2e7964a`:
https://github.com/absolutejs/geometry/actions/runs/40286232505
CI installs BVM using a pinned installer revision and selects the same project
Bun `1.4.4+absolute.1` used locally.

The dispatch-only publish workflow is prepared from the ecosystem template, with
BVM selection added. Its npm OIDC trust has **not** been configured or validated;
this first release used authenticated npm publishing. Do not claim unattended
future releases until the npm package publisher is bound to
`absolutejs/geometry`, `publish.yml`, environment `npm-publish`, and the GitHub
release environment is configured. No shared publishing template or PAAS was changed.
