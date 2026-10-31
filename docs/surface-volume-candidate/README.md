# Boundary integration candidate (not released)

Motivation: the game's exclusive physical wood fixtures require substantially more triangle work than additive limb fixtures; per-component culling no longer skips individual limbs inside one connected solid.

Background: Brian Mirtich, [Fast and Accurate Computation of Polyhedral Mass Properties](https://people.eecs.berkeley.edu/~jfc/mirtich/massProps.html), derives volume properties by reduction to surface integrals. The following plane-cut specialization is our derivation, not a quotation or implementation of his published algorithm.

Choose an origin O on the clipping plane and let y=x−O. The divergence theorem gives V=(1/3)∫ y·N dA, and first moment relative to O is (1/4)∫ y(y·N)dA. The newly cut cap contributes zero because y·N=0 there. On each original planar triangle, d=(reference−O)·N is constant; use its clipped area A and first area moment M about reference. Contribution is dA/3 to volume and d(M+(reference−O)A)/4 to the first moment about O. Translate back by adding O times volume. Preserve signed orientation, including cavity walls.

Origin is the projection of the component bounds center onto the plane. Full and dry components retain cached moments and conservative interval gates. This formula does not validate self-intersections, material exclusivity or fluid exposure.

Initial candidate passes existing analytic/cavity/scale/normal and independent native-cut tests. It currently uses the full triangle second-moment routine, although the formula only needs first moments. Benchmark before adoption: fewer primitive dimensions do not by themselves imply lower runtime. Query counters must distinguish surface work from tetrahedron work before release. Also ensure a triangle is not dropped merely because an unrelated full-volume decomposition tetrahedron is degenerate.

Final paired measurement: six alternating warmed batches on each of 12 exclusive physical components, 220 queries per batch and method. Median candidate/baseline runtime ratios range from 0.530 to 0.667 (33–47% lower measured CPU time). All 660 volume/first-moment comparisons pass; maximum volume error is 7.68e-12 and moment error 6.06e-12 after normalization. The final improvement comes from first-order-only work and cached immutable internal full/dry face results, not relaxing accuracy. Public triangle query arrays remain independent. Measurements are local CPU observations, not universal or GPU frame-rate claims.
