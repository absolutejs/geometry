# Bounded analytical rotation-plane contact

`firstRotationPlaneContact` adds an O(vertices), constant-workspace query for the
first contact of a rigidly rotating point-cloud boundary with a plane. For a whole
triangle mesh, its vertices suffice because signed plane distance is affine on
each triangle. If a caller clips the mesh first, the caller must include new edge
intersection vertices. This is a contact query, not impact response, fracture,
nonplanar terrain collision, or a physics-engine replacement.

Rodrigues rotation gives each point's signed plane distance as
`a cos(theta) + b sin(theta) + c`. The query solves the half-angle quadratic using
stable quadratic roots, avoiding phase subtraction near zero. It checks both
roots within the requested positive rotation (at most 2π), tangency, initial
contact and stationary trajectories. Axis and plane normal are normalized; the
plane constant is scaled with its normal. Returned contact distance exposes
floating-point residual rather than claiming exact arithmetic.

Inputs are bounded to 100,000 Float64 vertices and finite coordinates within 1e8,
with nondegenerate axis/normal and a finite bounded angle. All coordinates are
validated before early-contact classification. Inputs are read-only; returned
points are independently owned. Query work uses scalar temporaries per vertex,
with no per-vertex arrays or closures. Equal-angle ties retain the first vertex.
The clear half-space is `dot(normal, point) + constant > 0`.

Seven new tests cover analytical circles, stationary motion, tangency, initial
contact, empty intervals, translation/scaling covariance, 300 deterministic
arbitrary-axis comparisons against independent Rodrigues samples, malformed and
oversized inputs, and a positive contact angle of 1e-18 radians. Package checks
pass 158 tests / 315,312 assertions. The GPU-disabled browser worker passes four
controls including input transfer, rejection and successful recovery.

An initial tangent fixture added and subtracted sqrt(2), inadvertently creating
a representable circle slightly short of its intended plane. It correctly returned
clear. The fixture now uses an exactly representable 3-4-5 circle with its derived
atan2 angle; no geometric epsilon was introduced to force tangency. An initially
stale expected angle was also corrected. Both changes are test-oracle corrections.

The game's isolated `mature-architecture/saved-falls.ts` consumes this build, not
an installed dependency patch. It examines both original and candidate upper wood
vertices across 72 saved-fall fixtures each. Its contact residuals are below
3e-15 m in that matrix. Clip-edge intersections and rough terrain are not covered.
The earlier trunk-only landing estimate permits branch penetration; simply
stopping at this first rigid branch contact is not a complete physical fix.
Native branch response, bending, fracture and persistent topology remain separate.

This feature is not published yet. No npm authentication prompt has been opened.
