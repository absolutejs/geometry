type V = readonly [number, number, number];
/** Barycentric interpolation in the dominant plane avoids Gram-matrix cancellation
 * on thin triangles. Reject unrelated points instead of smearing attributes across seams. */
export function triangleWeights(
	p: V,
	a: V,
	b: V,
	c: V,
	maximumPlaneDistance = 1e-7
): [number, number, number] {
	if (
		!Number.isFinite(maximumPlaneDistance) ||
		maximumPlaneDistance < 1e-7 ||
		maximumPlaneDistance > 1e-5
	)
		throw Error('Invalid surface projection precision');
	if (![p, a, b, c].every((v) => v.length === 3 && v.every(Number.isFinite)))
		throw Error('Invalid interpolation point');
	const u = b.map((v, i) => v - a[i]!),
		v = c.map((v, i) => v - a[i]!),
		d = p.map((v, i) => v - a[i]!);
	const n = [
		u[1]! * v[2]! - u[2]! * v[1]!,
		u[2]! * v[0]! - u[0]! * v[2]!,
		u[0]! * v[1]! - u[1]! * v[0]!
	];
	const length = Math.hypot(...n);
	if (length < 1e-16) throw Error('Degenerate interpolation triangle');
	const signed = n.reduce((sum, x, i) => sum + x * d[i]!, 0) / length;
	if (Math.abs(signed) > maximumPlaneDistance)
		throw Error('Interpolation point is off surface');
	// Reconstruct attributes on the original plane; do not move the rendered/physical vertex.
	for (let i = 0; i < 3; i++) d[i]! -= (n[i]! * signed) / length;

	const axis = n.reduce(
			(best, x, i) => (Math.abs(x) > Math.abs(n[best]!) ? i : best),
			0
		),
		i = (axis + 1) % 3,
		j = (axis + 2) % 3;
	const denominator = u[i]! * v[j]! - u[j]! * v[i]!,
		wb = (d[i]! * v[j]! - d[j]! * v[i]!) / denominator,
		wc = (u[i]! * d[j]! - u[j]! * d[i]!) / denominator;
	const weights = [1 - wb - wc, wb, wc];
	if (weights.some((w) => w < -1e-4 || w > 1.0001))
		throw Error('Interpolation point is outside source triangle');
	const clamped = weights.map((w) => Math.max(0, Math.min(1, w))),
		sum = clamped.reduce((a, b) => a + b, 0);
	return clamped.map((w) => w / sum) as [number, number, number];
}
