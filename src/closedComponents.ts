/** Split welded closed components by index connectivity, never by spatial proximity.
 * Coincident vertices in distinct authored solids deliberately remain distinct. */
export function closedComponents(
	positions: Float64Array,
	indices: Uint32Array
) {
	if (
		!(positions instanceof Float64Array) ||
		positions.length % 3 ||
		positions.length > 300000 ||
		!positions.every(Number.isFinite) ||
		!(indices instanceof Uint32Array) ||
		indices.length % 3 ||
		indices.length > 600000 ||
		!indices.every((i) => i < positions.length / 3)
	)
		throw Error('Invalid component mesh');
	const parent = Int32Array.from(
			{ length: positions.length / 3 },
			(_, i) => i
		),
		used = new Uint8Array(parent.length);
	const find = (start: number) => {
		let root = start;
		while (parent[root] !== root) root = parent[root]!;
		while (start !== root) {
			const next = parent[start]!;
			parent[start] = root;
			start = next;
		}
		return root;
	};
	const edgeCounts = new Map<
		string,
		{ a: number; b: number; count: number }
	>();
	for (let i = 0; i < indices.length; i += 3)
		for (let j = 0; j < 3; j++) {
			const a = indices[i + j]!,
				b = indices[i + ((j + 1) % 3)]!;
			if (a === b) throw Error('Degenerate component triangle');
			used[a] = used[b] = 1;
			const ra = find(a),
				rb = find(b);
			if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
			const key = a < b ? `${a}:${b}` : `${b}:${a}`,
				edge = edgeCounts.get(key);
			if (edge) {
				if (edge.count !== 1 || edge.a !== b || edge.b !== a)
					throw Error('Nonmanifold component mesh');
				edge.count++;
			} else edgeCounts.set(key, { a, b, count: 1 });
		}
	if ([...edgeCounts.values()].some((e) => e.count !== 2))
		throw Error('Open component mesh');
	const groups = new Map<
		number,
		{
			positions: number[];
			indices: number[];
			sourceTriangles: number[];
			map: Map<number, number>;
		}
	>();
	for (let i = 0; i < parent.length; i++)
		if (used[i]) {
			const root = find(i);
			let group = groups.get(root);
			if (!group) {
				if (groups.size >= 128)
					throw Error('Component budget exceeded');
				group = {
					positions: [],
					indices: [],
					sourceTriangles: [],
					map: new Map()
				};
				groups.set(root, group);
			}
			group.map.set(i, group.positions.length / 3);
			group.positions.push(
				positions[i * 3]!,
				positions[i * 3 + 1]!,
				positions[i * 3 + 2]!
			);
		}
	for (let t = 0; t < indices.length; t += 3) {
		const group = groups.get(find(indices[t]!))!;
		for (let j = 0; j < 3; j++)
			group.indices.push(group.map.get(indices[t + j]!)!);
		group.sourceTriangles.push(t / 3);
	}
	return [...groups.values()].map((g) => ({
		positions: Float64Array.from(g.positions),
		indices: Uint32Array.from(g.indices),
		sourceTriangles: Uint32Array.from(g.sourceTriangles)
	}));
}
