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
