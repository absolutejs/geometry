# Direct plane-classification allocation reduction

Candidate based on queued geometry 0.17.0 at fcd1675; no new npm request.
The three signed triangle distances are computed with the same arithmetic and
finite checks. Entirely wet/dry queries avoid creating a distances array and
callback closures; crossing triangles retain the original clipping path.
Public validation, returned-array ownership and tiny-volume guards are unchanged.

All 108 package tests / 31,906 assertions pass. Across 9,600 recorded native branch
poses, volume and first moments match the queued reference exactly. Paired query
time was 7,951.77 ms versus 9,201.37 ms (ratio 0.8642); this is a CPU observation,
not a hardware FPS or whole-simulation performance claim. Full native trajectory
and timeout-recovery checks follow before release adoption. Game receipts live on
research/float-contact under docs/hydrostatic-hierarchy-2026-11-01/scalar-direct.

The separately tested face hierarchy was not adopted: traversal overhead erased
most of its benefit. Its source and rejected measurements remain on the research
branch, rather than becoming an unused runtime path in this candidate.
