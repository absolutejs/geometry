# Geometry 0.2.0 qualification — 2026-10-26

Add oriented shell splitting, bounded solid-angle membership, and cavity-aware
material partition. These were motivated by a real oak cut producing a valid inner
wall that the game incorrectly treated as a separate negative-volume body.

Analytic tests cover a hollow cube plus a disconnected same-owner cube, nested
material islands with cavities, source-owner isolation, touching shells, orphan
voids, budget exhaustion, translated coordinates, empty and open boundaries.
The original alpha projection suite remains required. Built ESM and GPU-disabled
browser module worker checks also pass. See README for the nonintersecting-input
precondition and numerical limits; this is not arbitrary mesh repair.

Game adoption and canonical-tree worker qualification follow the registry release.
