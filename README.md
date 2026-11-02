# @absolutejs/geometry

Worker-side measurement of alpha-masked triangle geometry. The first API measures
orthographic coverage without Three.js, a renderer, or a GPU. This is useful for
asset inspection, canopy gap measurement, and tools in a 3D website builder.

```ts
import { projectAlphaCoverage } from '@absolutejs/geometry';

const measurement = projectAlphaCoverage({
  positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
  uv: new Float32Array([0, 0, 1, 0, 0, 1]),
  indices: new Uint16Array([0, 1, 2]),
  alpha: new Uint8Array([255]),
  textureWidth: 1,
  textureHeight: 1,
  cutoff: 0.4,
  resolution: 256,
});
console.log(measurement.footprintArea, measurement.gapFraction);
```

## Coordinate and texture contract

Positions are xyz in the caller's projection frame, projected onto xz. Supply
transformed positions for the actual pose, preferably in local double precision.
An origin already rounded away in Float32 cannot be recovered. Indexed vertices
define a convex reference hull; its area includes transparent card extents and
gaps between disconnected leaves. This is a declared reference footprint, not a
botanical crown boundary. Units are caller-defined; areas use squared units.

UVs must already include any texture transform. Alpha is row-major, one byte per
texel, with v=0 at the first row: apply any image flip before calling. Bilinear
sampling uses the base texture level, wrapS/wrapT default to clamp, and alpha at
or above cutoff is covered. Repeat and mirrored repeat are supported. Faces are
two-sided; overlapping faces form a union. No color-space conversion applies to
alpha. Material opacity, vertex alpha, multiple materials and blend materials
must be resolved by the caller; this API does not silently approximate them.

## Results and accuracy

`cells` is a resolution-squared mask: 0 outside the reference hull, 1 open,
2 covered. Rows run from minZ to maxZ; columns from minX to maxX. `bounds` is
[minX, minZ, maxX, maxZ]. `footprintArea` is the analytic hull area;
`sampledFootprintArea` and `sampledCoveredArea` expose center-sampling error.
`coveredArea` normalizes the sampled coverage fraction to the analytic hull.
`gapFraction` is the open fraction of sampled hull cells.

Center sampling can miss thin geometry and small holes. Compare resolutions for
your asset; convergence is evidence, not a rigorous error bound. The game asset
audit in docs covers all eight canonical trees plus deformed and fallen examples.
This does not measure light transmission, rainfall interception, storage capacity,
wind deformation, mip-filtered screen coverage, or hydrologic history.

## Cost and ownership

Run this synchronous function in a worker or an offline asset pipeline, never a
render loop. It does not mutate input buffers. Transfer owned copies when worker
ownership must change; do not detach a renderer's borrowed geometry buffers.

Limits: 300,000 vertices, 200,000 triangles, 4,194,304 texture texels, resolution
8–1024, finite UV magnitudes at most 1,000,000. Triangle-local bounding rectangles
are charged against `maxPixelTests` (default 50 million, maximum 100 million)
before rasterization. The counter is conservative even when union early-outs
skip already covered cells. Hull construction sorts indexed vertices; scanline
setup walks convex hull edges. These limits bound work and allocation, not wall
time. Worker owners should additionally enforce deadlines and cancellation.
Malformed, unresolved, degenerate and over-budget inputs throw.

## Development

BVM selects Bun `1.4.4+absolute.1` from `.bun-version`.
Run `bun install --frozen-lockfile` and `bun run check:package`.
`bun scripts/audit-game-canopies.ts` additionally requires the Hello World checkout
and its development asset tooling; see docs/canopy-audit/README.md.

Licensed under BSL-1.1; see LICENSE for the additional use grant and change date.

## Worker-side alpha preparation (0.1.1)

`alphaFromRgba(rgba, width, height)` copies one alpha byte per RGBA8 texel into an
owned Uint8Array. It accepts Uint8Array or Uint8ClampedArray and validates the
exact byte length and the same 4,194,304-texel budget before allocation.

`alphaFromImageBitmap(bitmap)` reads an already decoded bitmap using a temporary
OffscreenCanvas 2D context with `willReadFrequently: true`. Call it in a worker;
it performs synchronous CPU readback wherever it is called. The temporary canvas
is released afterward. It does not create a WebGL context, close the input bitmap,
or detach any borrowed renderer resource. The caller owns bitmap cleanup.
Unsupported runtimes, closed/invalid bitmaps and oversized images fail explicitly.
There is no hidden main-thread fallback.

ImageBitmap supports structured cloning as well as transfer. The browser-worker
qualification checks exact alpha values and that closing a cloned worker image
leaves its source usable. Transfer only owned copies if using a transfer list.
See the [HTML ImageBitmap ownership contract](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmap)
and [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).
These helpers prepare raster inputs; they do not assign hydrologic meaning to alpha.

## Oriented solid boundaries (0.2.0)

`closedComponents(positions, indices)` splits index-connected closed oriented
boundary shells. Coincident coordinates never weld distinct authored vertices.
`solidPointMembership(positions, indices)` prepares a solid-angle classifier that
returns `inside`, `outside`, or `boundary`; oriented cavity walls cancel their
outer shell's winding inside a void.

`solidComponents(positions, indices, faceOwners, maxTriangleTests?)` returns
`{ components, shells, cavities, pointQueries, triangleTests }`. Each component
contains positions, indices and original `sourceTriangles`. It preserves separate
positive components of the same source, and assigns each inward cavity to the
smallest enclosing positive shell **of its explicitly declared source**. It never
infers source identity, takes absolute cavity mass, or uses a convex hull.

Precondition: each owner's input must be a valid, nonintersecting oriented solid
boundary, such as a validated Boolean kernel result. Shells must not touch.
Topology checks and all-cavity-vertex containment checks are **not** a complete
triangle-intersection validator; do not use this API to repair arbitrary soups.
An outward material island inside an inward cavity remains a separate component.
Deterministic order is positive-shell order, followed by each component's cavity
shells; provenance follows that same face order (not globally sorted).

Inputs are Float64 positions, Uint32 indices, and Int16/Uint16 per-face owners.
Limits: 100,000 vertices, 200,000 triangles, 128 shells. Prepared point classifiers
support up to 20,000 triangles; containment charges every tested outer triangle
per cavity vertex, with 2 million tests by default (maximum 8 million). No GPU,
Three.js, WASM, or runtime dependencies. All coordinates must share one local
frame; point boundary tolerance is 1e-7 coordinate units, winding tolerance 1e-5.
Near-degenerate faces, unresolved orientation, missing cavity parents, detected
touching/crossing shells and exhausted budgets throw rather than guess.

Sources: [Manifold's oriented boundary representation](https://manifoldcad.org/docs/jsuser/classes/Manifold.html)
and [Jacobson et al.'s generalized winding numbers](https://igl.ethz.ch/projects/winding-number/robust-inside-outside-segmentation-using-generalized-winding-numbers-siggraph-2013-jacobson-et-al.pdf).

## Initial material overlap audit (0.3.0)

`auditSolidOverlaps(meshes, kernel, maximumQueries = 256)` checks solid intersection
volumes before physics publication. Supply `{create(mesh), intersect(a,b)}` using
your Boolean backend. Handles implement `volume()` and `delete()`; each operation
must return a new owned handle. A factory that throws must release any allocation
it made before throwing. The audit releases all successfully returned handles on
both success and failure, and passes private position/index copies to the kernel.
No Boolean engine is bundled or required at runtime.

The result includes per-mesh oriented volumes, pair indices/intersection volumes,
fraction of the smaller solid, query count, bounds skips and maximum input volume
round-trip error. Touching/disjoint bounds need no native intersection. Candidate
pairs are rebased before construction. Native volume error above 1e-5 or impossible
intersection volume rejects; tiny nonzero intersections are reported, not rounded
away. The host chooses its material-resolution threshold explicitly.

Use valid oriented material boundaries, including cavity walls. The API does not
repair overlapping shells within one input mesh, assign source ownership, union
models, predict extraction clearance or validate dynamic contact penetration.
Bounds are not proof of overlap. Limits: 64 meshes, 100,000 total vertices,
200,000 total triangles, and at most 1,024 requested pair queries. A host worker
must impose its own lifetime bound on its injected native kernel.

## Exclusive material partition (0.4.0)

`partitionSolidMaterials(meshes, kernel, maximumOperations = 126)` implements
ordered solid ownership. Cell i is input i minus the union of earlier inputs.
The caller explicitly chooses the order; this library does not invent a material
priority. Inputs must be valid oriented solid boundaries, including cavity walls.

Supply `{create(mesh), subtract(a,b), union(a,b), mesh(solid)}`. Native handles
implement `volume()` and `delete()`; every construction/operation returns a fresh
handle, and failures inside the adapter must clean up allocations not returned.
`mesh` returns Float64 positions and Uint32 indices in the supplied local frame.
Return a valid closed boundary, or two empty arrays for an empty solid. The
package copies all borrowed arrays and releases native handles on success/failure.
At most three native handles are retained at once, including the output of the
current operation; previous union/intermediate geometry is promptly released.

Results include:
- `cells`: one entry per input, with stable `source` index, mesh and volume.
  A fully covered source remains an explicitly empty cell.
- `exterior`: the separate whole-union boundary and volume.
- `inputVolumes`, `authoredVolume`, `materialVolume`, `volumeDifference`,
  `maximumVolumeError` and `operations`. The signed volume difference is not
  clamped; insignificant negative roundoff can remain.

Cell walls include internal material interfaces. **Do not render every cell wall
as exposed material or infer that two touching cells are detached.** Exterior face
provenance, adjacency, strength, density, fracture surfaces and extraction/physics
acceptance remain host concerns. In particular this does not turn an existing
positive-overlap attachment graph into a surface-interface graph.

Limits: 1–64 inputs, 100,000 input vertices/200,000 input triangles, up to 126
Boolean operations, and 200,000 exported vertices/400,000 exported triangles
across all cells plus exterior. Native input/output volume and total conservation
errors above 1e-5 reject. These are acceptance budgets, not certified geometric
error bounds or a proof against a faulty Boolean backend. Topology checks do not
detect all geometric self-intersections. Use a cancellable worker: a synchronous
backend call cannot be interrupted by an operation counter.

The implementation uses the set identity
`C_i = S_i ∖ (S_0 ∪ … ∪ S_(i−1))`; its tests use Manifold only as a development
dependency. [Manifold's documentation](https://manifoldcad.org/docs/jsuser/classes/Manifold.html)
describes the native Boolean/volume contract. No Boolean engine is bundled.

## Boundary ancestry and optional Manifold adapter (0.5.0)

Partition kernels receive `create(mesh, sourceIndex)`. Their `mesh(solid)` can
return `origins: {sources: Uint16Array, faces: Uint32Array, reversed: Uint8Array}`,
one entry per output triangle. These identify a source mesh/triangle and whether
subtraction exposed its backside. This is **boundary ancestry**, distinct from a
cell's volume owner. The result copies and verifies this metadata; absent ancestry
is explicitly `null`.

`auditSurfaceOrigins(mesh, origins, sourceMeshes, maximumPlaneDistance = 1e-6)`
checks every output vertex against its nominated source triangle and verifies
winding. Invalid IDs, lengths, orientation, unrelated triangles and exhausted
budgets throw. The plane-distance acceptance range is 1e-7 through 1e-5 in the
input coordinate units; this is not a certified Boolean error bound.
`triangleWeights` exports the same dominant-plane barycentric interpolation for
material attributes, including thin triangles; it rejects off-surface points.

`mergeIndexedMesh(mesh, center, tolerance)` reconstructs indexed geometry using
an explicit merge map. It never welds nearby vertices by guessed distance.
It accepts three Float32 position properties, Uint32 indices and merge arrays,
checks finite coordinates/indices/merge displacement, and restores the supplied
origin in double precision. This reconstructs topology; use the separate closed
boundary/component validators where appropriate.

For Manifold **3.5.1**, the optional `@absolutejs/geometry/manifold` entry exports
`createManifoldPartitionKernel(wasm, sourceCount = 64)`. Pass your initialized
module. The optional peer is not imported at runtime and the core entry point
does not require Manifold.

The adapter supplies create/subtract/union/intersect/export, native status checks,
original mesh IDs, face IDs and backside flags. It creates fresh IDs for overlap
operands when no explicit source index is given. Export now preserves native
**double-precision positions** through `getManifoldMesh64(solid)`, also exported
from the optional Manifold entry. A temporary property channel stores exact integer
indices into a bounded sidecar captured by Manifold's property callback; the final
Float32 property index recovers the original double position. No simplification,
proximity welding or tolerance change is used. The temporary native copy is freed.

`getManifoldMesh64` returns owned arrays with interleaved Float64 `vertProperties`,
`numProp`, triangle indices, explicit merge maps, original IDs, face IDs, run
boundaries and per-run `reversed` flags. Extra property values keep native getMesh
export semantics (including transformed normals); only position precision is
upgraded. The input solid remains owned and unchanged by the caller. The result
is an export record, not an input accepted directly by Manifold's Float32 Mesh API.

Limits:200,000 triangles,100,000 exported property vertices,16 extra channels,
and at most600,000 position callbacks. `mergeIndexedMesh` accepts Float32 or
Float64 position-only buffers and still uses explicit merge ancestry. Core imports
remain independent of Manifold.

`createManifoldMesh64(wasm, mesh)` imports a position-only mesh with `numProp: 3`,
Float64 `vertProperties`, Uint32 `triVerts`, and optional native mesh metadata
(such as face IDs and original source runs). The partition adapter uses this
helper. It constructs the required Float32 native Mesh, then restores the exact
original coordinates via native warp **before** Boolean operations. It rejects
nonfinite coordinates, distinct doubles with the same rounded Float32 position,
unknown native vertices, and changes to vertex/triangle counts during import or
restoration. Input bounds are 100,000 vertices and 200,000 triangles. Intermediate
native handles are released; callers own the returned solid.

This does not recover coordinates already lost before this call, repair topology,
certify self-intersection freedom, or guarantee every thin mesh can pass the native
Float32 constructor. Rejections are explicit. Keep precision-sensitive operations
native until final export when possible; repeated serialization/rebasing can still
introduce slivers at coincident cut faces.

The ancestry contract does not assign grain across a newly cut face spanning
multiple materials, validate a collider, or prove a physical attachment.

## Principal inertia frame

`principalInertiaFrame(tensor)` accepts nine finite numbers containing a symmetric
row-major inertia tensor, in any consistent mass/length units. It returns sorted
positive `principal` moments and an `{x,y,z,w}` unit-quaternion `frame` mapping
principal coordinates into the original coordinates. The bounded double-precision
Jacobi solver checks symmetry, physical moment inequalities and reconstruction;
it rejects invalid input rather than repairing it. Isotropic/repeated moments may
have non-unique physical axes; the returned frame is deterministic for identical
input, not a temporally continuous orientation for animations.

Use the full tensor, including off-diagonal terms. This helper does not integrate
mesh mass or validate collisions. When passing explicit mass properties to Rapier,
set collision-shape density to zero to avoid adding their mass a second time; unit
conversion remains the caller's responsibility. No physics engine is imported.

### Unoriented fibre mixtures

`axialOrientationTensor([{axis: [1, 0, 0], weight: 1}, ...])` returns the
second orientation moment as a transferable row-major Float64Array. Directions
are normalized and weights are nonnegative. An axis and its negation contribute
identically, avoiding cancellation when blending wood, hair or textile fibre axes.
All-zero weights, zero axes and invalid input fail explicitly; at most 4096
samples are accepted. Input arrays are never changed. Finite vector and weight
scales near the limits of double precision are normalized before accumulation.

The output is symmetric, positive semidefinite and has trace one. It intentionally
does not choose a unique direction for isotropic or conflicting orientations.
A second moment discards higher-order distribution information; it is neither a
full fibre distribution nor a biological growth, fracture or constitutive model.
Use a separate calibrated material model for strength and breaking forces.

Thin-face membership uses scaled normals and dominant-plane projection. Nonzero
faces are not rejected by an absolute area cutoff; exactly collinear boundary
faces retain their edges. The existing 1e-7 boundary tolerance and winding checks
remain unchanged. This does not make Boolean geometry exact below native feature
limits, and does not alter source topology or repair degenerate whole solids.


### Plane-clipped tetrahedron moments

`tetrahedronPlaneMoments(vertices, planePoint, planeNormal)` integrates the part
of a four-vertex oriented tetrahedron on the side
`dot(position - planePoint, planeNormal) <= 0`. The normal need not be unit length.
It returns signed clipped/full volumes, their ratio, a centroid (null for an
empty cut), a reference point and signed first moments relative to that reference.
Input arrays are borrowed synchronously and never changed. No engine or native
allocation is required; work is bounded by four faces and six crossed edges.

```ts
import { tetrahedronPlaneMoments } from '@absolutejs/geometry';
const cut = tetrahedronPlaneMoments(
  [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [0.5, 0, 0], [1, 1, 1]
);
// cut.signedVolume = 1/48; cut.centroid = [0.125, 0.125, 0.125]
```

Orientation matters: reversing two vertices reverses signed volume and moments.
For a valid closed-solid tetrahedral decomposition, sum signed contributions;
do not take each contribution's absolute value. To combine first moments with a
common reference `r`, add `firstMoment + signedVolume * (reference - r)`.
The helper does not construct or validate that decomposition. Tiny represented
wet corners are retained using a shared cut-vertex integration origin, with no
absolute volume cutoff. Degenerate or unrepresentable results throw; this is
floating-point geometry, not exact predicates. A ratio can exceed one by accepted
floating-point roundoff up to 1e-12; no silent clamping repairs the output.

This measures geometry, not buoyancy or fluid response. A sealed air compartment
and an open flooded cavity do not exclude the same water volume; the caller must
supply the appropriate physical region. Water-surface curvature, density, force,
torque, pressure dynamics and clock ownership are separate responsibilities.

### Prepared plane moments (0.11)

For repeated cuts of an unchanged body-local tetrahedron, use
`prepareTetrahedronPlaneMoments(vertices)` and call the returned function with
`(planePoint, planeNormal)`. Preparation owns a copy of the four vertices and
caches plane-independent normalization and full moments. Each query returns the
same signed-volume, centroid and relative-first-moment contract as
`tetrahedronPlaneMoments`. Returned arrays can be changed without modifying
later queries. Rebuild the prepared query when source geometry changes.

For moving rigid bodies, transform the plane into body-local coordinates and
transform the resulting centroid back. The package does not supply rigid-body
forces, water clocks, sealing/flooding rules or a displacement-mesh validity
certificate. Signed tetrahedral contributions must retain their orientation.

This version also improves determinant conditioning for exterior-apex
compositions and constructs clipping intersections locally to preserve small
edges at translated coordinates. Existing one-shot queries use the same corrected
implementation; no numerical invariant is relaxed.

### Clipped triangle surface moments (0.12)

`prepareTrianglePlaneMoments(vertices)` owns three finite vertices and returns a
query `(planePoint, planeNormal)` retaining `dot(x-planePoint,planeNormal)<=0`.
`trianglePlaneMoments(vertices, planePoint, planeNormal)` is the one-shot form.
Both return unsigned `area`, `fullArea`, `fraction`, `centroid` (null when empty),
`surfaceNormal` preserving source winding, `reference`, `firstMoment` and the
row-major nine-entry `secondMoment`. Moments integrate local coordinates relative
to `reference`: first is ∫r dA, second is ∫rrᵀ dA. Reversing winding reverses only
the normal, not area or the physical moments. Coplanar triangles are fully retained.

For an affine scalar field `s(x)=a+b·(x-reference)`, its surface integral is
`a*area + b·firstMoment`, and its position-weighted integral relative to reference
is `a*firstMoment + secondMoment*b`. This supports distributed pressure and other
linear fields without replacing them with a centroid-only approximation. Rebase
first moments with `m'=m+A*d`; second moments with
`S'=S+d*mᵀ+m*dᵀ+A*d*dᵀ`, where `d=reference-newReference`.

Preparation caches shape normalization and full moments. Each result owns its
arrays. Invalid, degenerate and unrepresentable inputs or results throw; no area
cutoff discards small represented wet patches. This is binary64 geometry, not
exact predicates. Relative area roundoff up to 1e-12 is accepted without clamping.
The function does not determine external fluid exposure, validate a closed mesh,
remove internal material interfaces, infer drag coefficients or apply physics.

### Prepared material-solid cuts (0.13)

`prepareSolidPlaneMoments({positions, indices, owners})` prepares repeated plane
cuts of an unchanged oriented material mesh. Positions are Float64Array, indices
Uint32Array, and per-triangle source owners Int16Array or Uint16Array. Owners
must preserve cavity identity. The input must describe mutually exclusive valid
material regions; the helper checks closed components and cavity grouping but
does not certify intersections between different owners.

The returned `(planePoint, planeNormal)` function retains the nonpositive side.
It reports `volume`, `fullVolume`, `fraction`, `centroid`, `firstMoment`,
`reference`, and work `stats`. Rebase first moments using
`firstMoment + volume*(reference-newReference)`. All arrays are owned. Rebuild
preparation after geometry changes.

Wholly dry components contribute zero. Wholly wet components reuse cached full
moments. A conservative bounds margin sends uncertain classifications through
exactly the same tetrahedron clipping path as partial components. Work counters
report full/dry/partial components, exact tetra queries, cavities and degenerate
zero-volume decomposition tetrahedra. Small bodies that always cross the plane
may pay classification overhead without saving queries.

No camera-dependent timestep, force, air-sealing, fluid-exposure or drag policy
is introduced. Signed tetra contributions are summed without taking absolute
values. The result is not silently clamped; relative volume roundoff within
1e-10 is allowed. Centroids of very small immersed regions can be ill-conditioned
when signed contributions cancel; use aggregate first moments where possible.
A nonpositive residual volume has a null centroid. Nonfinite or inconsistent
results throw. These are floating-point integration rules, not exact predicates.

### Geometry 0.14 plane integration

Partial closed-solid queries now integrate first-order moments of clipped boundary triangles. The clipping cap has zero flux about an origin on its plane. Full/dry component gates remain conservative. `stats.evaluatedSurfaceTriangles` counts partial-boundary queries; `clippedTetrahedra` remains present and is zero for this path. Preparation still independently checks full moments with signed tetrahedra. No topology, ancestry, material-exclusivity or fluid-exposure requirements are relaxed. Runtime benefits depend on geometry; this is not a world simulation budget guarantee.

### Closing authored convex tubes

`closeConvexTube(positions, indices)` closes two convex boundary rings using their existing vertices. It returns owned Float64 `positions`, Uint32 `indices`, Float32 cap triangle coordinates and planar cap UV coordinates. Use the indexed double mesh for material operations; the cap arrays are rendering attributes. Side-face order and winding are retained after seam compaction. No averaged cap-center vertices are added.

This is bounded local tube preparation, not general hole repair or a self-intersection certificate: at most two rings of 64 vertices, local coordinate magnitudes <=1000, seam welding on a 1e-6 grid and plane residual <=1e-5. Nonmanifold edges, inconsistent edge winding, warped and nonconvex/star boundary rings are rejected. Slightly nonplanar input rings can change their piecewise-planar cap approximation when retriangulated; compare mass properties when adopting it for existing assets.

## Exact zero-extent shell regularization

`regularizeZeroExtentShells(positions, indices)` removes only complete disconnected
closed shells whose coordinate range is exactly zero on at least one axis. Such
shells have no 3D interior. There is no epsilon, near-flat test or volume cutoff;
even subnormal nonzero thickness is retained. Non-axis-aligned flat geometry is
also retained. This is a narrow certificate for coincident tool-plane artifacts,
not general mesh repair or a complete regularized Boolean implementation.

Results contain owned `positions`, `indices`, a retained `sourceTriangles` map,
`retainedShells`, and `removed` certificates with axis, coordinate and original
face indices. Topology must be closed before processing. Run it in the frame that
makes the intended plane exact, before rotating or translating output for display.

## Native cut sessions

`createManifoldCutSession(wasm, inputs, maximumCuts?)` is available from the optional
`@absolutejs/geometry/manifold` entry. Inputs and cutters are closed oriented meshes
in one caller-chosen common frame. The session unions the inputs once and retains
the native solid across cuts, avoiding a Float32 import of generated thin triangles
between operations. It does not infer a tool frame or snap nearly shared planes.

```ts
const session = createManifoldCutSession(wasm, sourceMeshes);
try {
  const initial = session.snapshot();
  const result = session.cut(cutterMesh);
  // result.retained / result.removed are owned mesh copies.
  // origins identify initial input or accepted cutter index, original face, backside.
  // result.sequence counts accepted material-removing cuts; air strikes do not count.
} finally {
  session.dispose();
}
```

Each exported snapshot verifies face ancestry against owned source copies and
reports exact zero-extent sheets separately. Failed edits leave the previous
native state intact and release pending handles. Physical volume conservation
must agree within 1e-8 relative to the pre-cut material. This is geometry acceptance,
not collision, grain, canopy, motion or material-strength certification. Callers
must keep the worker bounded and explicitly dispose sessions; rendering copies
must not be treated as a lossless serialization of native session state.

Limits: 1–63 initial sources, at most 32 accepted cuts, at most 64 total source IDs,
100,000 source vertices and 200,000 source triangles across all inputs/cutters,
|coordinate| ≤ 1000, and bounded native exports. Default cut budget is the smaller
of 32 and the remaining source-ID capacity. Snapshot statistics expose native
counts, volume/tolerance, exported triangles and removed sheet triangles for
host diagnostics. No GPU or engine initialization is performed by this adapter.

Double import now assigns a unique original face ID per triangle when IDs are
omitted. Without this, the native Float32 constructor can merge rounded coplanar
faces before restoration; immediate import volume can still match while a later
cut changes. Explicit face IDs retain caller semantics.

Disjoint or merely touching cutter bounds skip native splitting (`broadPhaseSkipped`). This remains allowed after the accepted-cut quota is full. Empty snapshots report `nativeTolerance: null`; skipped empty results report `nativeEvaluated: false`. No near-contact tolerance is introduced by this broad phase.

## Read-only native coverage

`auditManifoldCoverage(wasm, target, candidates)` from the Manifold entry, or
`session.auditCoverage(candidates)`, compares candidate cells with actual material
components while retaining native target geometry. Results include owned target
and component meshes, independent missing/excess volumes, measured cell
intersections, cross-body overlap and bounded operation counts. Temporary native
objects are always released; standalone callers retain ownership of `target`.

Overlapping cells are unioned for coverage, so summed collider volume is not
mistaken for physical mass. Cavity walls and nested islands remain separate
material components. The API reports geometry evidence; it does not certify
convexity, contacts or a game's acceptance policy. Bounds and qualification notes
are in `docs/native-coverage-2026-10-31/README.md`.

## Positive quadratic triangle moments

`prepareTrianglePositiveQuadraticMoments([a, b, c])` owns a finite, nondegenerate
triangle and returns a query accepting three scalar values at its vertices. It
integrates their affine interpolant `s` over the portion where `s > 0`: area,
`integral = ∫s² dA`, `cubicIntegral = ∫s³ dA`, and
`relativeFirstMoment = ∫(x-reference)s² dA`. `meanOffset` is the quadratic-weighted
point relative to the owned `reference`, or null for zero pressure. The result
also includes full area and the oriented unit surface normal. Returned arrays
are owned; mutating them does not affect future queries.

The query clips in triangle barycentric coordinates and integrates polynomial
moments analytically. It does not subdivide into samples, call WASM, infer a drag
coefficient, determine exposure to flow, or advance a body. Keeping moments in a
relative frame avoids forming a weighted absolute position at large coordinates.
Non-finite inputs, degenerate triangles and unrepresentable output powers throw.
This is double-precision arithmetic, not an exact-arithmetic geometry kernel.

An optional second query argument supplies three affine domain values. Integration
then includes only points where both pressure scalar and domain scalar are
positive. For a horizontal waterline, supply each vertex's depth below the
surface as the domain value. This clips wet area exactly before computing the
pressure moments; a fully dry domain yields zero moments. Domain boundaries
carry no area, and a field that is identically zero is excluded. This remains a
flat boundary calculation, not a wave or fluid solver.

Closed-solid surface queries validate the plane once, then use an internal
normalized-plane path for each triangle. Public triangle queries retain their
input validation and owned results. Surface flux is accumulated with scalar
coordinates to avoid temporary vectors; clipping rules, component ownership,
precision guards and summation order are unchanged.

## Positive linear triangle moments

`prepareTrianglePositiveLinearMoments([a, b, c])` owns the same validated triangle
geometry and affine-domain clipping as the quadratic query. Its returned function
accepts three finite field values and an optional three-value positive domain.
It integrates the positive linear field: `integral = integral(s dA)` and
`relativeFirstMoment = integral((x-reference) s dA)`. `meanOffset` is the weighted
point relative to `reference`, or null for a zero result. `area`, `fullArea` and
oriented `surfaceNormal` are also returned. Every returned array is owned.
There is no `cubicIntegral` on the linear result.

For hydrostatic pressure, field values may be vertex depths below a waterline,
with an explicitly supplied domain describing the exposed region. The math does
not decide contact sealing, permeability or fluid connectivity. A caller can
assemble force from `-normal * integral` and torque from the first moment, with
its own physical coefficient and reference-frame conversion.

An all-zero domain is empty. Exactly opposed field/domain values are also empty:
this is an exact identity at all three vertices, not an epsilon or volume cutoff.
Nearby thin positive domains remain integrated. Nonfinite/unrepresentable results
reject explicitly. Fully retained domains share the direct polynomial fast path;
crossing domains retain analytic clipping without point sampling.

### Bounded surface domains (queued 0.17.0 extension)

`partitionTriangleAffineDomains(triangle, domains, options)` partitions a triangle
into convex polygons. Each domain is an intersection of affine fields supplied as
three values at the input vertices; nonnegative values are inside. Returned
`reference`, `relativePositions`, `barycentric` and `domains` arrays are owned by the result. Positions stay relative to the input triangle origin, avoiding collapse when a small partition sits at a large absolute coordinate. Retain the origin through downstream transforms; adding it prematurely can lose that precision. Domain
indices describe each polygon's relative interior; zero-area boundary fragments
are not separate cells. An identically zero field includes the full polygon.
`partitionTriangleBoxDomains` supplies the six fields for each axis-aligned box.

Use the barycentric coordinates for attribute interpolation and fan-triangulate
each convex polygon. Defaults limit output to 1,024 cells and 8,192 vertices;
explicit limits are checked during partitioning. Invalid input, unrepresentable
intersections, area-conservation failure or exhausted budgets throw, without
returning partial results. These are bounded double-precision operations, not
exact-arithmetic Boolean solid repair. Domain membership is not a proof of solid
ownership: applications must establish their own material/volume assumptions.

For example, the triangle `[[0,0,0],[1,0,0],[0,1,0]]` and one domain
`[[[-0.5,0.5,0.5]]]` separate the region `x+y >= 0.5`; its area is `0.375`.
A positive rescaling of the affine field describes the same domain.

### Repeated source-face interpolation

`prepareTriangleWeights(a, b, c, maximumPlaneDistance?)` owns a prepared source
triangle and returns a point-query function. Use it when multiple cut vertices
share the same source face. It preserves dominant-plane projection, outside-face
rejection and the existing projection-distance limits; each result is an owned
three-element array. `triangleWeights` remains the one-shot form. Nonrepresentable
geometry or query arithmetic rejects instead of returning nonfinite weights.

## Repeated upward surface queries

`prepareUpwardSurface({ positions, indices, cellSize: 4 })` builds an owned XZ
spatial index for upward-wound mesh faces. Positions are Float32Array or
Float64Array xyz triples; indices are Uint16Array or Uint32Array triangle triples.
Coordinates and heights must use the same frame and units. The game can reuse it
for terrain support; builders can inspect walkable surfaces or place objects.

```ts
const surface = prepareUpwardSurface({ positions, indices });
const { hit, trianglesTested } = surface.query(x, z, referenceY, 1);
// hit is null without coverage within one unit of referenceY, otherwise:
// { height, slopeX, slopeZ, triangle }
```

The nearest upward surface is returned, not necessarily the highest surface.
Downward ceilings and exactly vertical/degenerate projections are excluded.
Equal-distance ties retain input triangle order. No height is extrapolated across
missing coverage. `maxDistance` is inclusive; callers needing a strict threshold
can apply it to the result. Optional fifth query argument `edgeTolerance`
(default 1e-8, maximum 1e-4) controls dimensionless barycentric edge tolerance
inside indexed cells; it does not expand the index's geometric footprint.

Preparation retains no input buffers: they may be changed or transferred after
preparation. `.stats` reports triangle/upward-face/cell/reference counts and
coefficient bytes (not total JS/Map overhead). Each query reports actual indexed
triangle visits. Inputs are capped at 262,144 vertices and 131,072 triangles;
`maxReferences` defaults to 262,144 and cannot exceed 1,048,576. Grid reference
expansion is checked before inserting a face, so an enormous face with tiny cells
fails rather than silently causing unbounded work. Invalid inputs, unsafe grid
coordinates and nonfinite arithmetic throw RangeError. Empty meshes are allowed.

This module imports no renderer, React or physics engine. A support hit is not a
solid-membership result, a contact manifold or proof that a body is balanced.
Multiple chunks must be queried in their own coordinate frames; missing neighboring
geometry remains unknown. Use repeated sample queries to build application-specific
support policies rather than treating a single center hit as whole-object support.

### Bounded star-shaped mesh partition candidates (0.19)

`partitionStarShapedMesh(mesh, kernel, options?)` creates one positive convex
 tetrahedron per outward surface triangle. Input is an already-qualified simple,
star-shaped, connected closed boundary with Float64 positions and Uint32 indices,
and a known strict interior kernel. This is not general convex decomposition:
there is no kernel search, topology repair, proximity welding, or whole-solid
convex-hull fallback. Self-intersection validation remains the caller's input
precondition. Independently audit coverage/overlap and the collision engine's
exported geometry and mass before using the pieces for physics.

```ts
import { partitionStarShapedMesh } from '@absolutejs/geometry';
const partition = partitionStarShapedMesh(mesh, [0, 0, 0]);
// Each piece owns Float64 positions and Uint32 indices, in coordinates relative
// to partition.origin. Reapply that origin exactly once when placing the result.
```

The default budget is 256 triangles; callers may select 4–1024. Kernel clearance
must exceed source extent times `minimumRelativeClearance` (default 1e-9,
allowed 1e-12 through 0.1). A determinant floor of extent³ × 1e-14 rejects tiny
numerically precarious cells. Unrepresentable scales, shared mutable buffers,
open/nonmanifold/disconnected boundaries, reversed winding, and boundary/outside
kernels fail explicitly. Unreferenced vertices do not affect geometric extent.
The result includes source-triangle ancestry, total signed volume and measured
minimum kernel clearance. It has no native WASM lifetime or runtime dependency.
