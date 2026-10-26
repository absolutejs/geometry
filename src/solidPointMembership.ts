import { closedComponents } from './closedComponents.js';
type Point = readonly [number, number, number];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const sub = (a: Point, b: Point): Point => [
	a[0] - b[0],
	a[1] - b[1],
	a[2] - b[2]
];
/** Exact solid-angle sum for a closed oriented boundary, with explicit boundary
 * classification. No convex hull, nearest-center assignment or sampled rays.
 * Formula: Jacobson et al. 2013; see README sources and numerical limits. */
export function solidPointMembership(
	positions: Float64Array,
	indices: Uint32Array
) {
	if (!indices.length || indices.length > 60000)
		throw Error('Solid point mesh budget exceeded');
	closedComponents(positions, indices); // Require closed, consistently oriented topology.
	const min = [Infinity, Infinity, Infinity],
		max = [-Infinity, -Infinity, -Infinity];
	const collapsedEdges: [Point, Point][] = [];
	const triangles: {
		a: Point;
		b: Point;
		c: Point;
		u: Point;
		v: Point;
		n: Point;
		area2: number;
	}[] = [];
	for (let i = 0; i < indices.length; i += 3) {
		const points = [0, 1, 2].map((k) => {
			const id = indices[i + k]! * 3;
			return [
				positions[id]!,
				positions[id + 1]!,
				positions[id + 2]!
			] as Point;
		});
		const [a, b, c] = points as [Point, Point, Point],
			u = sub(b, a),
			v = sub(c, a),
			n = cross(u, v),
			area2 = dot(n, n);
		for (const p of points)
			for (let k = 0; k < 3; k++) {
				min[k] = Math.min(min[k]!, p[k]!);
				max[k] = Math.max(max[k]!, p[k]!);
			}
		// A clipping kernel may keep distinct topological vertices at identical
		// coordinates. Such a face has exactly zero solid angle. Keep its edges
		// for boundary queries without welding vertices or altering the mesh.
		if (
			area2 === 0 &&
			[u, v, sub(c, b)].some((edge) => edge.every((n) => n === 0))
		) {
			collapsedEdges.push([a, b], [b, c], [c, a]);
			continue;
		}
		if (!(area2 > 1e-30)) throw Error('Degenerate solid point face');
		triangles.push({ a, b, c, u, v, n, area2 });
	}
	if (!triangles.length) throw Error('Degenerate solid point mesh');
	return (point: Point): 'inside' | 'outside' | 'boundary' => {
		if (point.length !== 3 || !point.every(Number.isFinite))
			throw Error('Invalid solid query point');
		const epsilon = 1e-7;
		if (
			point.some((v, k) => v < min[k]! - epsilon || v > max[k]! + epsilon)
		)
			return 'outside';
		for (const [a, b] of collapsedEdges) {
			const edge = sub(b, a),
				delta = sub(point, a),
				length2 = dot(edge, edge);
			const t =
				length2 === 0
					? 0
					: Math.max(0, Math.min(1, dot(delta, edge) / length2));
			if (Math.hypot(...delta.map((v, k) => v - t * edge[k]!)) <= epsilon)
				return 'boundary';
		}
		let sum = 0,
			correction = 0;
		for (const { a, b, c, u, v, n, area2 } of triangles) {
			const delta = sub(point, a),
				distance = dot(delta, n);
			if (distance * distance <= epsilon * epsilon * area2) {
				// Barycentric coordinates of the orthogonal projection, using cross products
				// instead of subtracting nearly equal Gram determinants on thin faces.
				const s = dot(cross(delta, v), n) / area2,
					t = dot(cross(u, delta), n) / area2;
				if (s >= -1e-10 && t >= -1e-10 && s + t <= 1 + 1e-10)
					return 'boundary';
			}
			const vectors = [a, b, c].map((p) => sub(p, point));
			const lengths = vectors.map((p) => Math.hypot(...p));
			if (lengths.some((l) => l <= epsilon)) return 'boundary';
			const [x, y, z] = vectors.map(
				(p, i) => p.map((v) => v / lengths[i]!) as unknown as Point
			) as [Point, Point, Point];
			const angle =
				2 *
				Math.atan2(
					dot(x, cross(y, z)),
					1 + dot(x, y) + dot(y, z) + dot(z, x)
				);
			const increment = angle - correction,
				next = sum + increment;
			correction = next - sum - increment;
			sum = next;
		}
		const winding = Math.abs(sum) / (4 * Math.PI);
		if (winding < 1e-5) return 'outside';
		if (Math.abs(winding - 1) < 1e-5) return 'inside';
		throw Error('Ambiguous solid point membership');
	};
}
