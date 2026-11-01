# Bounded triangle domain partition research

This unpublished extension partitions a triangle into convex surface polygons by intersections of affine half-spaces. It preserves barycentric attributes, winding and area, with explicit cell/vertex limits and no partial output on failure. The AABB adapter supplies six fields per box. The operation assigns domain membership, not solid material ownership.

Six focused analytic/randomized tests pass. The game measures all 168 native-cut cases with limb-aligned enclosing boxes: 18,187 rendered cut triangles versus 18,009 original; 10.017838595 / 10.020056853 square metres have unique domain membership, zero absent domains and zero partition rejections. The default case has 98.068% unique area. Game source/artifact receipts are recorded separately; integration is not yet adopted.

The axis-box predecessor rejected six thin triangles on its area gate; its source is retained here. Do not weaken that gate. The affine implementation interpolates within the original triangle plane and the oriented bounds avoid broad, irrelevant overlaps. This research does not replace the previously queued exact 0.17.0 archive until full qualification and a new archive are complete.

The canonical API now names its membership arrays `domains` and exports `TriangleDomainCell`. A subsequent precision regression rejects absolute-coordinate export collapse (a unit triangle translated to 2^52), while accepting the same local-coordinate partition. All 123 package tests / 71,361 assertions pass. The 168-case research matrix above precedes that additional export guard; current integration qualification is recorded separately rather than relabeling the older receipt.
