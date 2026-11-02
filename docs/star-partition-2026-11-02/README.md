# Geometry 0.19.0 candidate — bounded star partition

Adds `partitionStarShapedMesh`, a dependency-free, bounded source-face fan for
already-qualified simple star-shaped closed meshes with a supplied strict kernel.
Outputs stay Float64 and kernel-local, with positive tetrahedral winding, source
triangle ancestry, total volume and minimum clearance. This is not a general
convex decomposition or self-intersection certificate. No repair, proximity weld,
kernel search, approximate hull fallback or physical-readiness flag is supplied.

The API has a default 256 / hard 1024 face budget. It rejects bad typed buffers,
shared mutable inputs, disconnected/open/nonmanifold topology, unsafe numeric
scales, and outside/boundary/near-boundary kernels. Unreferenced vertices do not
change the geometric scale. Native collision-engine mass/coverage still require
independent qualification. Existing geometry modules remain byte-for-byte
unchanged in the archive except the entrypoint's additive exports.

Qualification so far:
- All 141 package tests / 73,591 assertions pass; TypeScript build passes.
- Native Manifold union/subtraction verifies missing, excess and aggregate overlap
  for a genuinely concave source independently of the partition's signed volume.
- Built and exact-archive browser-worker checks pass, preserving transferred
  Float64 buffers, ancestry and rejected kernel behavior. GPU/WebGL disabled.
- An isolated archive consumer imports the published entrypoint and runs the API.
- `archive-verification.json` records the exact archive SHA256 and every shipped
  file; only README, package metadata and barrel exports differ among prior files.

Independent build and game-authored stone checks are recorded separately as they
complete. Source and archive must be backed up before npm publication. No game
production dependency is changed before that publication is verified.

Final candidate checks: a second clean-worktree build matches every shipped archive
file exactly (`independent-build.json`). The exact archive also passes 24 game
qualification cases: four authored stone shapes × three nonuniform size scales ×
local/distant source coordinates. The local outputs match the original fixture
coordinates exactly; translated-coordinate error remains below 1e-10 m. Native
Rapier 0.21.0 exported-boundary missing/excess/overlap and density-derived mass pass
1e-5 relative thresholds. Full case records remain in the game's durable docs.
These are candidate qualification checks; no game production import is redirected
to this worktree or its archive consumer.
