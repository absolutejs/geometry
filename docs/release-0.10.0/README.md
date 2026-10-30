# Geometry 0.10.0 — plane-clipped tetrahedral moments

Adds `tetrahedronPlaneMoments`, a bounded double-precision geometric primitive for
partial volume and centroid measurement. It preserves orientation, reports first
moments relative to an explicit reference, and rejects invalid/degenerate or
unrepresentable results. No dependency, native kernel, mesh Boolean or source
mutation is added. Existing exports are unchanged.

The implementation clips the four oriented faces against the plane and integrates
signed pyramids from a shared cut vertex. Cap triangles have zero volume about
that on-plane origin, so they need not be constructed. Crossed edges are cached
and interpolated from the closer endpoint in original coordinates. This avoids
subtracting body-sized coordinates before constructing a tiny wet corner. Scale
normalization and local first moments limit cancellation; they are not a proof of
exact floating-point predicates for arbitrary ill-conditioned geometry.

The mathematical background is volume-to-surface integration, reviewed by
[David Eberly, Polyhedral Mass Properties](https://www.geometrictools.com/Documentation/PolyhedralMassProperties.pdf)
and [Brian Mirtich's work](https://people.eecs.berkeley.edu/~jfc/mirtich/).
The implementation here is an independent tetrahedral clipping construction;
no source code from those references is copied.

Build and 54 package tests pass (21,114 assertions). Coverage includes analytic
plane cuts, centroid/first-moment formulas, complementary and reversed cuts,
small translated tetrahedra, wet corners down to 1e-60 edge scale, normal scales
1e-300 to 1e300, signed composition of a box from an exterior origin, and explicit
underflow rejection. 240 native Manifold cuts independently check volume; capped
native meshes also check centroids through a different divergence-integral formula.

Built Node ESM, transferable worker and native partition consumers pass. The
GPU-disabled browser module worker checks the new export, exact analytic sample,
invalid-normal rejection and 20,480 bounded calls. Five 4,096-call batches take
36.4, 31.9, 19.8, 22.6 and 19.8 ms in this run. This is a unit-tetrahedron CPU
measurement, not a body/scene budget or hardware FPS qualification. Browser errors:
none. The artifact and registry release remain separate qualification steps.

A geometric clipped volume is not automatically the water-displacing volume of a
hollow or floodable object. No live-world force coupling or boat model is claimed.

The exact 30,479-byte archive is retained beside this record. All 36 packaged
files match the reviewed built files byte-for-byte; an isolated extracted public
ESM import returns the analytic volume and centroid. SHA1:
`3c25820c8098ac7a941177602dac9bb8cf3c7cfb`. Registry publication is not yet verified.
