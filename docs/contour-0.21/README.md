# Optional bounded edge-root refinement

Adds a local scalar oracle to `prepareScalarContour2D`, with explicit callback
budget and shared edge roots. Nearest queries remain callback-free. Existing
unrefined extraction and the cell topology decision remain unchanged.

151 tests pass (74,717 assertions), including nonlinear scalar bias, callback
budget enforcement, endpoint sign disagreement, finite samples, discontinuous
sign transitions, exact zero endpoints, horizontal/vertical crossings, query
independence and curved-contour convergence against exhaustive segment queries.
The actual browser worker consumes transferred input and executes the oracle.
Independent TypeScript builds match all 64 shipped files. The exact packed
archive consumer checks the nonlinear crossing within 10 micrometres.

The game excavation study demonstrates why this is only one part of a solution:
root refinement fixes scalar-interpolation bias, but sharp corners still require
finer cells. A 0.125 m construction differs from a local 0.0625 m reference by up
to 0.010753 m in the sampled edited shoreline. This is measured convergence at
one site, not a global distance certificate or a rendering speed improvement.
Published as 0.21.0 and adopted from the registry by the game.

The registry archive matches the qualified bytes. Metadata and the plain tarball
URL initially returned 404; the encoded scope URL served the matching archive,
then normal exact-version Bun installation succeeded. Both local tarballs, build
duplicates, temporary consumer extraction and npm pack cache were removed.
No GPU work was performed.
