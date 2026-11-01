import { test, expect } from "bun:test";
import { partitionTriangleBoxDomains } from "../src/triangleBoxDomains";
const triangle = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
] as const;
const area = (p: Float64Array) => {
  let a = 0;
  for (let i = 3; i + 3 < p.length; i += 3)
    a +=
      ((p[i]! - p[0]!) * (p[i + 4]! - p[1]!) -
        (p[i + 1]! - p[1]!) * (p[i + 3]! - p[0]!)) /
      2;
  return a;
};
test("overlapping boxes partition exact analytic triangle areas and preserve winding/attributes", () => {
  const boxes = [
    { min: [0, 0, -1], max: [0.5, 1, 1] },
    { min: [0.25, 0, -1], max: [1, 1, 1] },
  ] as const;
  const cells = partitionTriangleBoxDomains(triangle, boxes),
    totals = new Map<string, number>();
  for (const c of cells) {
    const key = Array.from(c.boxes).join(",");
    totals.set(key, (totals.get(key) ?? 0) + area(c.positions));
    expect(area(c.positions)).toBeGreaterThan(0);
    for (let i = 0; i < c.positions.length; i += 3) {
      expect(
        c.barycentric[i]! + c.barycentric[i + 1]! + c.barycentric[i + 2]!,
      ).toBeCloseTo(1, 14);
      expect(c.positions[i]).toBeCloseTo(c.barycentric[i + 1]!, 14);
      expect(c.positions[i + 1]).toBeCloseTo(c.barycentric[i + 2]!, 14);
      expect(c.positions[i + 2]).toBe(0);
    }
  }
  expect(totals.get("0")).toBeCloseTo(0.21875, 14);
  expect(totals.get("0,1")).toBeCloseTo(0.15625, 14);
  expect(totals.get("1")).toBeCloseTo(0.125, 14);
  expect(totals.has("")).toBe(false);
});
test("closed boundaries, absent boxes and zero-width boxes have explicit area semantics", () => {
  expect(partitionTriangleBoxDomains(triangle, [])[0]!.boxes.length).toBe(0);
  expect(
    partitionTriangleBoxDomains(triangle, [
      { min: [0, 0, 0], max: [1, 1, 0] },
    ])[0]!.boxes,
  ).toEqual(new Uint32Array([0]));
  for (const b of [
    { min: [1, 0, -1], max: [2, 1, 1] },
    { min: [0.5, 0, -1], max: [0.5, 1, 1] },
  ] as const) {
    const cells = partitionTriangleBoxDomains(triangle, [b]);
    expect(cells.every((c) => c.boxes.length === 0)).toBe(true);
    expect(cells.reduce((s, c) => s + area(c.positions), 0)).toBe(0.5);
  }
});
test("thin positive regions survive and output owns its buffers", () => {
  const width = 2 ** -40,
    cells = partitionTriangleBoxDomains(triangle, [
      { min: [0, 0, -1], max: [width, 1, 1] },
    ]);
  const inside = cells.filter((c) => c.boxes.length);
  expect(inside.reduce((s, c) => s + area(c.positions), 0)).toBeCloseTo(
    width - (width * width) / 2,
    20,
  );
  cells[0]!.positions.fill(99);
  expect(triangle[0][0]).toBe(0);
  expect(partitionTriangleBoxDomains(triangle, [])[0]!.positions[0]).toBe(0);
});
test("rejects invalid geometry and bounded output overflow without partial answers", () => {
  expect(() =>
    partitionTriangleBoxDomains(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      [],
    ),
  ).toThrow();
  expect(() =>
    partitionTriangleBoxDomains(triangle, [{ min: [1, 0, 0], max: [0, 1, 1] }]),
  ).toThrow();
  expect(() =>
    partitionTriangleBoxDomains(
      triangle,
      [{ min: [0, 0, -1], max: [0.5, 1, 1] }],
      { maxCells: 1 },
    ),
  ).toThrow("budget");
  expect(() =>
    partitionTriangleBoxDomains(triangle, [], { maxVertices: 2 }),
  ).toThrow();
  expect(() =>
    partitionTriangleBoxDomains(triangle, [
      { min: [NaN, 0, 0], max: [1, 1, 1] },
    ]),
  ).toThrow();
});

test("seeded oblique, translated and scaled partitions preserve area and interior box membership", () => {
  let seed = 123456789;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let trial = 0; trial < 240; trial++) {
    const scale = 10 ** ((trial % 21) - 10),
      shift = [0, 1, 2].map(() => scale * (random() - 0.5) * 100);
    const t = [0, 1, 2].map(() =>
      [0, 1, 2].map((_, a) => shift[a]! + scale * (random() - 0.5)),
    ) as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ];
    const boxes = Array.from({ length: 6 }, () => {
      const low = [0, 1, 2].map(
        (_, a) => shift[a]! + scale * (random() - 0.65),
      ) as [number, number, number];
      return {
        min: low,
        max: low.map((x) => x + scale * (0.05 + random() * 0.8)) as [
          number,
          number,
          number,
        ],
      };
    });
    const cells = partitionTriangleBoxDomains(t, boxes);
    let normalizedArea = 0;
    for (const cell of cells) {
      const w = cell.barycentric;
      let twice = 0;
      for (let i = 3; i + 3 < w.length; i += 3)
        twice +=
          (w[i + 1]! - w[1]!) * (w[i + 5]! - w[2]!) -
          (w[i + 2]! - w[2]!) * (w[i + 4]! - w[1]!);
      expect(twice).toBeGreaterThanOrEqual(0);
      normalizedArea += twice;
      const center = [0, 1, 2].map((a) => {
        let v = 0;
        for (let i = a; i < cell.positions.length; i += 3)
          v += cell.positions[i]!;
        return v / (cell.positions.length / 3);
      });
      for (const [id, b] of boxes.entries()) {
        const d = center.flatMap((x, a) => [x - b.min[a]!, b.max[a]! - x]);
        if (Math.min(...d) > scale * 1e-10)
          expect(Array.from(cell.boxes)).toContain(id);
        if (Math.min(...d) < -scale * 1e-10)
          expect(Array.from(cell.boxes)).not.toContain(id);
      }
      for (let i = 0; i < cell.positions.length; i += 3)
        for (let a = 0; a < 3; a++) {
          const reconstructed =
            t[0][a]! * w[i]! + t[1][a]! * w[i + 1]! + t[2][a]! * w[i + 2]!;
          expect(
            Math.abs(cell.positions[i + a]! - reconstructed) / scale,
          ).toBeLessThan(1e-12);
        }
    }
    expect(Math.abs(normalizedArea - 1)).toBeLessThan(1e-10);
  }
});

test('affine domains classify oblique half-spaces and intersect opposed fields without phantom area',async()=>{
 const {partitionTriangleAffineDomains}=await import('../src/triangleBoxDomains');
 const cells=partitionTriangleAffineDomains(triangle,[[[-.5,.5,.5]]]);
 expect(cells.filter(c=>c.boxes.length).reduce((s,c)=>s+area(c.positions),0)).toBeCloseTo(.375,14);
 const empty=partitionTriangleAffineDomains(triangle,[[[-.5,.5,.5],[.5,-.5,-.5]]]);
 expect(empty.every(c=>c.boxes.length===0)).toBe(true);
 expect(empty.reduce((s,c)=>s+area(c.positions),0)).toBeCloseTo(.5,14);
 const scaled=partitionTriangleAffineDomains(triangle,[[[-5e30,5e30,5e30]]]);
 expect(scaled.map(c=>Array.from(c.positions))).toEqual(cells.map(c=>Array.from(c.positions)));
 expect(()=>partitionTriangleAffineDomains(triangle,[[]])).toThrow();
});
