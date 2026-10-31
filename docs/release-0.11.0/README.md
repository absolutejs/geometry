# Geometry 0.11.0: prepared plane queries and conditioning fixes

This additive release introduces `prepareTetrahedronPlaneMoments(vertices)` and
fixes two precision issues in the existing one-shot query. The prepared function
owns its vertices and caches plane-independent geometry. Each call receives a
plane and returns the same oriented volume, centroid, relative first moment and
reference contract. It does not retain mutable per-plane state or caller arrays.

The captured game failure is a valid almost-full tetrahedron from a moving cut
limb. A distant decomposition apex produced three nearly parallel long edges in
the full-volume determinant. The revised calculation chooses the vertex nearest
the tetrahedron's vertex mean and computes original-coordinate differences before
normalization. An independent rational oracle over the binary64 inputs confirms
the signed volume. Expanded tests revealed a separate world-coordinate rounding
issue in short intersection edges; cut geometry is now formed relative to the
input vertex nearest the plane, before applying the world offset to the final
centroid. No orientation, volume or representability invariant was relaxed.

Validation: 58 tests / 22,942 assertions, including 192 exact-input conditioning
cases across all vertex permutations, scales 1e-60 through 1e60, translation and
distant apexes. The Python Fraction oracle generator is committed and imports no
production geometry code. Existing native Manifold comparisons, tiny-tip tests,
consumer imports and transferable worker tests pass. Prepared-query tests mutate
both source vertices and earlier output arrays to verify ownership.

GPU-disabled Chrome checks all 192 conditioning cases, wet/dry complements, the
analytic sample and invalid-normal rejection. Direct and prepared benchmarks
produce identical checksums over 20,480 calls each. Timings are stored in
browser-worker.json and are bounded microbenchmarks, not a scene/FPS budget.

The exact archive contains 37 files (31,680 bytes), all byte-identical to the
reviewed build and packaged source files. An isolated extracted public ESM import
passes the prepared analytic query. SHA1 and SHA512 are in archive.json. The
archive is committed for crash recovery. Publication and game adoption are
separate steps and must be verified against the registry checksum.

The game qualification is using an explicit archive override, not a dependency
patch. Its installed dependency remains published 0.10.0 until registry adoption.
Local-plane queries and endpoint load reuse significantly reduce the measured
cut-limb audit cost. This does not establish a live-world body budget, wave
pressure, drag, fluid reaction or sealed-hull behavior. Preparation must be rebuilt
when geometry changes; static-reservoir endpoint reuse is invalid if the water
plane or body pose changes outside the qualified step sequence.
