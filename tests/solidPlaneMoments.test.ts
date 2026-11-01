import { test, expect } from "bun:test";
import { prepareSolidPlaneMoments } from "../src/solidPlaneMoments";
type V = [number, number, number];
const faces = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4,
  7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
];
function box(low: V, high: V, reverse = false) {
  const p = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ].flatMap((v) => v.map((x, k) => (x ? high[k]! : low[k]!)));
  const indices = faces.slice();
  if (reverse)
    for (let t = 0; t < indices.length; t += 3)
      [indices[t + 1], indices[t + 2]] = [indices[t + 2]!, indices[t + 1]!];
  return { positions: p, indices };
}
function mesh(parts: { box: ReturnType<typeof box>; owner: number }[]) {
  const positions: number[] = [],
    indices: number[] = [],
    owners: number[] = [];
  for (const p of parts) {
    const offset = positions.length / 3;
    positions.push(...p.box.positions);
    indices.push(...p.box.indices.map((i) => i + offset));
    owners.push(...Array(p.box.indices.length / 3).fill(p.owner));
  }
  return {
    positions: Float64Array.from(positions),
    indices: Uint32Array.from(indices),
    owners: Uint16Array.from(owners),
  };
}
const close = (a: number, b: number, t = 1e-11) =>
  expect(Math.abs(a - b)).toBeLessThan(t);
test("closed solid culling keeps cavity volume and first moments, and owns input and outputs", () => {
  const input = mesh([
    { box: box([0, 0, 0], [2, 2, 2]), owner: 0 },
    { box: box([0.5, 0.5, 0.5], [1.5, 1.5, 1.5], true), owner: 0 },
    { box: box([4, 0, 0], [5, 1, 1]), owner: 1 },
  ]);
  const q = prepareSolidPlaneMoments(input);
  const half = q([0, 1, 0], [0, 1, 0]);
  close(half.volume, 4.5);
  close(half.firstMoment[0], 8);
  close(half.firstMoment[1], 2.125);
  close(half.firstMoment[2], 4);
  expect(half.stats.cavities).toBe(1);
  const isolated = q([3, 0, 0], [1, 0, 0]);
  close(isolated.volume, 7);
  expect(isolated.stats.fullComponents).toBe(1);
  expect(isolated.stats.dryComponents).toBe(1);
  expect(isolated.stats.clippedTetrahedra).toBe(0);
  input.positions.fill(99);
  input.indices.fill(0);
  input.owners.fill(99);
  isolated.reference[0] = 99;
  isolated.firstMoment[0] = 99;
  isolated.centroid![0] = 99;
  const again = q([3, 0, 0], [1, 0, 0]);
  close(again.volume, 7);
  close(again.centroid![0], 1);
  expect(again.reference).toEqual([0, 0, 0]);
});
test("plane complements preserve full moments across boundaries and normal magnitudes", () => {
  const q = prepareSolidPlaneMoments(
    mesh([{ box: box([0, 0, 0], [1, 1, 1]), owner: 0 }]),
  );
  for (const normalScale of [1e-200, 1, 1e200])
    for (const depth of [
      -1e-10,
      0,
      1e-14,
      0.1,
      0.5,
      0.9,
      1 - 1e-14,
      1,
      1 + 1e-10,
    ]) {
      const a = q([0, depth, 0], [0, normalScale, 0]),
        b = q([0, depth, 0], [0, -normalScale, 0]),
        wet = Math.max(0, Math.min(1, depth));
      close(a.volume, wet);
      close(a.firstMoment[1], (wet * wet) / 2);
      close(a.volume + b.volume, 1);
      for (let k = 0; k < 3; k++)
        close(a.firstMoment[k]! + b.firstMoment[k]!, 0.5);
    }
  expect(q([0, -1, 0], [0, 1, 0]).stats.clippedTetrahedra).toBe(0);
  expect(q([0, 2, 0], [0, 1, 0]).stats.clippedTetrahedra).toBe(0);
});
test("relative moments are stable under translation and scale", () => {
  for (const scale of [1e-40, 1e-6, 1, 1e6, 1e40])
    for (const translated of [false, true]) {
      const offset = translated ? 10000 * scale : 0;
      const q = prepareSolidPlaneMoments(
        mesh([
          {
            box: box(
              [offset, offset, offset],
              [offset + scale, offset + scale, offset + scale],
            ),
            owner: 0,
          },
        ]),
      );
      const r = q([offset, offset + 0.5 * scale, offset], [0, 1, 0]);
      close(r.volume / scale ** 3, 0.5, 1e-10);
      close(r.firstMoment[1] / scale ** 4, 0.125, 1e-10);
      close((r.centroid![0] - offset) / scale, 0.5, 1e-10);
    }
});
test("rejects malformed ownership, open boundaries and invalid planes", () => {
  const input = mesh([{ box: box([0, 0, 0], [1, 1, 1]), owner: 0 }]);
  const q = prepareSolidPlaneMoments(input);
  expect(() => q([0, 0, 0], [0, 0, 0])).toThrow("Zero clipping normal");
  expect(() => q([NaN, 0, 0], [0, 1, 0])).toThrow();
  expect(() =>
    prepareSolidPlaneMoments({ ...input, owners: new Uint16Array(1) }),
  ).toThrow();
  expect(() =>
    prepareSolidPlaneMoments({
      ...input,
      indices: input.indices.slice(3),
      owners: input.owners.slice(1),
    }),
  ).toThrow();
});

test("boundary flux preserves thin slab moments and ignores tangential plane-point offsets", () => {
  const q = prepareSolidPlaneMoments(
    mesh([{ box: box([0, 0, 0], [1, 1, 1]), owner: 0 }]),
  );
  for (const depth of [1e-12, 1e-9, 1e-6, 0.25, 0.75])
    for (const tangent of [0, 1e12, -1e12]) {
      const r = q([tangent, depth, -tangent], [0, 1, 0]);
      expect(Math.abs(r.volume / depth - 1)).toBeLessThan(1e-10);
      expect(Math.abs(r.firstMoment[0] / (depth / 2) - 1)).toBeLessThan(1e-10);
      expect(
        Math.abs(r.firstMoment[1] / ((depth * depth) / 2) - 1),
      ).toBeLessThan(1e-9);
      expect(Math.abs(r.firstMoment[2] / (depth / 2) - 1)).toBeLessThan(1e-10);
      expect(r.stats.clippedTetrahedra).toBe(0);
      expect(r.stats.evaluatedSurfaceTriangles).toBe(12);
    }
});

function refine(input: ReturnType<typeof mesh>, levels: number) {
  let positions = Array.from(input.positions),
    indices = Array.from(input.indices),
    owners = Array.from(input.owners);
  for (let level = 0; level < levels; level++) {
    const edges = new Map<string, number>(),
      next: number[] = [],
      nextOwners: number[] = [];
    const middle = (a: number, b: number) => {
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const found = edges.get(key);
      if (found !== undefined) return found;
      const index = positions.length / 3;
      for (let k = 0; k < 3; k++)
        positions.push(
          positions[a * 3 + k]! +
            (positions[b * 3 + k]! - positions[a * 3 + k]!) * 0.5,
        );
      edges.set(key, index);
      return index;
    };
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t]!,
        b = indices[t + 1]!,
        c = indices[t + 2]!,
        ab = middle(a, b),
        bc = middle(b, c),
        ca = middle(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      nextOwners.push(...Array(4).fill(owners[t / 3]!));
    }
    indices = next;
    owners = nextOwners;
  }
  return {
    positions: Float64Array.from(positions),
    indices: Uint32Array.from(indices),
    owners: Uint16Array.from(owners),
  };
}
test("hierarchical face aggregation retains thin slabs, complements, scale and cavity moments", () => {
  for (const scale of [1e-40, 1, 1e40]) {
    const input = refine(
        mesh([{ box: box([0, 0, 0], [scale, scale, scale]), owner: 0 }]),
        3,
      ),
      query = prepareSolidPlaneMoments(input);
    for (const depth of [1e-12, 1e-9, 0.2, 0.5, 0.9]) {
      const r = query([0, depth * scale, 0], [0, 1, 0]),
        c = query([0, depth * scale, 0], [0, -1, 0]);
      expect(Math.abs(r.volume / (depth * scale ** 3) - 1)).toBeLessThan(1e-9);
      expect(
        Math.abs(r.firstMoment[1] / (0.5 * depth ** 2 * scale ** 4) - 1),
      ).toBeLessThan(1e-8);
      expect(Math.abs((r.volume + c.volume) / scale ** 3 - 1)).toBeLessThan(
        1e-10,
      );
      for (let k = 0; k < 3; k++)
        expect(
          Math.abs((r.firstMoment[k]! + c.firstMoment[k]!) / scale ** 4 - 0.5),
        ).toBeLessThan(1e-10);
      expect(r.stats.evaluatedSurfaceTriangles).toBeLessThan(
        input.indices.length / 3,
      );
    }
  }
  const q = prepareSolidPlaneMoments(
    refine(
      mesh([
        { box: box([0, 0, 0], [2, 2, 2]), owner: 0 },
        { box: box([0.5, 0.5, 0.5], [1.5, 1.5, 1.5], true), owner: 0 },
      ]),
      2,
    ),
  );
  const r = q([0, 1, 0], [0, 1, 0]);
  close(r.volume, 3.5);
  close(r.firstMoment[1], 1.625);
  expect(r.stats.cavities).toBe(1);
});
