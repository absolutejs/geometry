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
