# Geometry0.6.0 — principal inertia frames

BVM Bun1.4.4+absolute.1; build and37 tests /14590 assertions pass.
The new pure-double bounded Jacobi eigensolver has160 rotated analytic box cases
across25 scales, repeated/nearly repeated moments, thin bodies, deterministic
output and invalid tensor rejection. Tests reconstruct tensors from the returned
quaternion and moments, not only from internal eigenvectors. No engine dependency.

Built Node ESM/transfer smoke and GPU-disabled browser module-worker checks pass.
The browser exercises the new inertia API in addition to existing transfer and
bitmap ownership paths. These are portability checks, not hardware benchmarks.

Hello World's separate native Rapier experiment compares eight pine/oak cutting
sequences and every retained/removed component across six inertia directions.
Automatic native mesh inertia has a31 percent worst directional mismatch on a
small severed pine piece. Explicit full-tensor integration and these principal
frames reduce the maximum relative directional mismatch below5.5e-7, with mass
error below8.4e-8. Physical mass is supplied once, collision density is zero.
Those fixtures remain game-specific evidence, not a claim of universal collision
or trajectory correctness. Native data and reproduction code live in the game's
docs/material-provenance-2026-10-26 folder.

Published after npm browser confirmation; registry version0.6.0 verified with
SHA1 d7a6800237f6c46418f6a508a28502a57d69de6d. Hello World installed the exact
registry release. No sibling checkout is used by its application runtime.
