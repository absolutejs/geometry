# Geometry 0.5.0 qualification

BVM Bun 1.4.4+absolute.1. Build and 34 tests / 12,494 assertions pass.
Built Node/ESM native adapter passes. GPU-disabled browser import/transfer checks
pass; these smoke checks do not themselves execute Manifold in that browser.

New coverage includes original source IDs and triangles, reversed internal
interfaces, false ancestry, winding disagreement, malformed metadata, copy
isolation, thin triangle interpolation, explicit merge ancestry, invalid merge
maps, and per-solid export precision at small geometric scales. Existing partition
conservation/lifetime coverage remains in the suite.

The game has separately exercised the candidate adapter on real pine/oak branch
partitions and eight physical-union cutting sequences, preserving bark/root/tool
surface categories and cavity-aware physical component counts. See its durable
docs/material-provenance-2026-10-26 records. This is not collider or trajectory
qualification.
