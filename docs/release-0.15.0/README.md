# Geometry 0.15.0 release qualification

Adds reusable closeConvexTube, extracted from the game's authored tube helper. Cap triangles use original boundary vertices instead of an averaged center. Local input constraints and topology/ancestry/volume tolerances are unchanged. All existing geometry modules are byte-identical to 0.14; only index exports and the new module differ.

75 package tests pass (31,582 assertions), including strict native partition ancestry on captured variants 2/3 that previously failed. Cap volume changes are at most 3.51e-8 relative. Browser module workers pass with transferred typed inputs and eight unchanged cap-boundary vertices. Independent builds match all 40 output files. All 43 extracted archive files match, and an extracted-package closed-tube volume query passes. Archive SHA1: 530a3fddb7f017c0a039f24507207c79048a2b09.

Game candidate qualification: 880 static pressure/moment/mass cases across eight physical variants; 76,800 native steps at 480 Hz (20 seconds each), maximum normalized energy drift 1.599e-5. The full maintained suite under the in-memory candidate helper passes 922 tests / 7,501,823 assertions, and targeted branch/deformation/inertia checks pass. Production remains on registry 0.14 until publication/adoption. Worker consumers and the installed production path will be checked after adoption; candidate preloading is not a delivered dependency patch.

Limitations: convex authored tubes only; no arbitrary-hole repair, self-intersection certificate, drag, collision-proxy acceptance or universal tree/cut qualification. Existing bark vertices are preserved; slightly nonplanar caps can have a different piecewise-planar approximation. No native GPU test was launched.
