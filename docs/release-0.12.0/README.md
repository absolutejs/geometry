# Geometry 0.12.0 candidate: clipped surface moments

Adds prepared and one-shot triangle half-space queries, with unsigned area,
relative first and second area moments, and oriented face normals. Existing
volume queries are unchanged. This is a reusable geometric operation; neither
fluid exposure nor a hydrodynamic model is inferred.

Positive subtriangle integration avoids subtracting nearly equal areas for a
thin retained strip. Single-corner area follows two edge fractions. Intersections
are formed in a local frame, and preparation owns its inputs. Returned arrays
cannot corrupt subsequent queries. Nonempty underflows are errors, not dry faces.

66 tests / 29,582 assertions pass. New tests include analytic corner and strip
integrals, scales 1e-60 to 1e60, reversed winding, mutable-array ownership, explicit
boundary/error behavior, 300 translated random plane complements with moment
rebasing, and 180 independent native prism cuts. Native-cut surface second moments
are integrated with degree-two barycentric quadrature. No production clipping
function supplies that reference geometry.

GPU-disabled Chrome passes 100 triangle worker cases and all existing module,
transfer, bitmap, inertia, membership and 193 volume precision cases. This does
not measure GPU rendering performance.

The game candidate audit checks distributed affine hydrostatic pressure on 480
retained/removed authored-tree pieces, against an independent closed-surface
volume integral. Maximum normalized force discrepancy 4.121e-11, torque 2.372e-10.
These are static-force checks, not acceptance of drag, waves, flooding or a
runtime body budget. The installed game remains on published geometry 0.11.0.

Publication pending; archive and registry checks must be recorded separately.

The captured-pose audit additionally passes 3,200 samples across all eight actual
cut limbs' twenty-second trajectories. Maximum normalized force discrepancy is
3.031e-12 and torque discrepancy 2.221e-12. This independently checks distributed
surface pressure at the sampled poses, not the accuracy of the trajectories.

The exact release archive has 39 files, 34,220 bytes, SHA1
`5413d65fa477e134afcf80283b76064cff912d6c`. Every archived file was compared
byte-for-byte with the reviewed package build/source. An extracted public ESM
import passes the analytic second-moment check. Registry publication is pending.

Published successfully 2026-10-31. Registry version, SHA1 and SHA512 were verified
against archive.json after propagation. npm did not require another browser
confirmation. The game is adopting the registry package, with no local override.
