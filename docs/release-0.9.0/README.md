# Geometry 0.9.0 — thin-face solid membership

A native double-position pine cut contains a valid face with squared area
1.29679e-34. The previous absolute 1e-30 area cutoff rejected the entire solid,
preventing canopy ownership queries after accurate export. This fix scales
triangle edges before computing a normal, uses unit-normal plane distance and
dominant-plane barycentrics, and preserves all nonzero-area faces. Exactly
collinear topological faces retain their edges for boundary queries, contributing
zero solid angle. No vertices are welded and no source mesh is modified.

Boundary tolerance remains 1e-7 m, winding acceptance and mesh budgets unchanged.
This is floating-point classification, not an exact-predicate or arbitrary-scale
geometry guarantee. Closed oriented topology is still required. The captured
fixture originates from Hello World's authored pine model; it contains only mesh
coordinates, indices and reproduction parameters.

Build and 47 tests /18715 assertions pass. New analytic cube subdivisions include
collinear and thin faces down to 1e-300 height; inside/outside/boundary answers and
input preservation are checked. The real cut fixture verifies every vertex is
recognized as boundary. Both new tests fail against the prior implementation.
Built Node ESM, existing native partition consumer and GPU-disabled browser worker
checks pass. The browser transfers a thin-face fixture and returns all three
membership classifications. This uses no native GPU.

A separate game candidate bundle passes 13 tests /2238681 assertions covering
canopy variants/phenotypes/cuts, physical components and finite cut conservation.
Its source and receipts are under the game's material-provenance-2026-10-26 docs.
Registry adoption and the complete game suite remain separate release steps.

Publication verified 2026-10-26 after npm registry processing: version 0.9.0,
SHA1 `d97ddfb825c1e00117cd6f1f7150ebae0128e7de`, matching the prepared tarball.
Release source `0892f8b5a674aedd6f812198f5f06273c00841c4` is pushed to main.
Game adoption and its separate regression results are recorded in the game repo.
