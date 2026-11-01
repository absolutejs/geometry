import { test, expect } from "bun:test";
import { partitionTriangleBoxDomains } from "../src/triangleDomains";
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
    const key = Array.from(c.domains).join(",");
    totals.set(key, (totals.get(key) ?? 0) + area(c.relativePositions));
    expect(area(c.relativePositions)).toBeGreaterThan(0);
    for (let i = 0; i < c.relativePositions.length; i += 3) {
      expect(
        c.barycentric[i]! + c.barycentric[i + 1]! + c.barycentric[i + 2]!,
      ).toBeCloseTo(1, 14);
      expect(c.relativePositions[i]).toBeCloseTo(c.barycentric[i + 1]!, 14);
      expect(c.relativePositions[i + 1]).toBeCloseTo(c.barycentric[i + 2]!, 14);
      expect(c.relativePositions[i + 2]).toBe(0);
    }
  }
  expect(totals.get("0")).toBeCloseTo(0.21875, 14);
  expect(totals.get("0,1")).toBeCloseTo(0.15625, 14);
  expect(totals.get("1")).toBeCloseTo(0.125, 14);
  expect(totals.has("")).toBe(false);
});
test("closed boundaries, absent boxes and zero-width boxes have explicit area semantics", () => {
  expect(partitionTriangleBoxDomains(triangle, [])[0]!.domains.length).toBe(0);
  expect(
    partitionTriangleBoxDomains(triangle, [
      { min: [0, 0, 0], max: [1, 1, 0] },
    ])[0]!.domains,
  ).toEqual(new Uint32Array([0]));
  for (const b of [
    { min: [1, 0, -1], max: [2, 1, 1] },
    { min: [0.5, 0, -1], max: [0.5, 1, 1] },
  ] as const) {
    const cells = partitionTriangleBoxDomains(triangle, [b]);
    expect(cells.every((c) => c.domains.length === 0)).toBe(true);
    expect(cells.reduce((s, c) => s + area(c.relativePositions), 0)).toBe(0.5);
  }
});
test("thin positive regions survive and output owns its buffers", () => {
  const width = 2 ** -40,
    cells = partitionTriangleBoxDomains(triangle, [
      { min: [0, 0, -1], max: [width, 1, 1] },
    ]);
  const inside = cells.filter((c) => c.domains.length);
  expect(inside.reduce((s, c) => s + area(c.relativePositions), 0)).toBeCloseTo(
    width - (width * width) / 2,
    20,
  );
  cells[0]!.relativePositions.fill(99);
  expect(triangle[0][0]).toBe(0);
  expect(
    partitionTriangleBoxDomains(triangle, [])[0]!.relativePositions[0],
  ).toBe(0);
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
        for (let i = a; i < cell.relativePositions.length; i += 3)
          v += cell.relativePositions[i]! + cell.reference[a]!;
        return v / (cell.relativePositions.length / 3);
      });
      for (const [id, b] of boxes.entries()) {
        const d = center.flatMap((x, a) => [x - b.min[a]!, b.max[a]! - x]);
        if (Math.min(...d) > scale * 1e-10)
          expect(Array.from(cell.domains)).toContain(id);
        if (Math.min(...d) < -scale * 1e-10)
          expect(Array.from(cell.domains)).not.toContain(id);
      }
      for (let i = 0; i < cell.relativePositions.length; i += 3)
        for (let a = 0; a < 3; a++) {
          const reconstructed =
            t[0][a]! * w[i]! + t[1][a]! * w[i + 1]! + t[2][a]! * w[i + 2]!;
          expect(
            Math.abs(
              cell.relativePositions[i + a]! +
                cell.reference[a]! -
                reconstructed,
            ) / scale,
          ).toBeLessThan(1e-12);
        }
    }
    expect(Math.abs(normalizedArea - 1)).toBeLessThan(1e-10);
  }
});

test("affine domains classify oblique half-spaces and intersect opposed fields without phantom area", async () => {
  const { partitionTriangleAffineDomains } =
    await import("../src/triangleDomains");
  const cells = partitionTriangleAffineDomains(triangle, [[[-0.5, 0.5, 0.5]]]);
  expect(
    cells
      .filter((c) => c.domains.length)
      .reduce((s, c) => s + area(c.relativePositions), 0),
  ).toBeCloseTo(0.375, 14);
  const empty = partitionTriangleAffineDomains(triangle, [
    [
      [-0.5, 0.5, 0.5],
      [0.5, -0.5, -0.5],
    ],
  ]);
  expect(empty.every((c) => c.domains.length === 0)).toBe(true);
  expect(empty.reduce((s, c) => s + area(c.relativePositions), 0)).toBeCloseTo(
    0.5,
    14,
  );
  const scaled = partitionTriangleAffineDomains(triangle, [
    [[-5e30, 5e30, 5e30]],
  ]);
  expect(scaled.map((c) => Array.from(c.relativePositions))).toEqual(
    cells.map((c) => Array.from(c.relativePositions)),
  );
  expect(() => partitionTriangleAffineDomains(triangle, [[]])).toThrow();
});

test("relative output preserves tiny domains beside a large absolute origin", async () => {
  const { partitionTriangleAffineDomains } =
    await import("../src/triangleDomains");
  const origin = 2 ** 52;
  const shifted = partitionTriangleAffineDomains(
    [
      [origin, 0, 0],
      [origin + 1, 0, 0],
      [origin, 1, 0],
    ],
    [[[-1, 1, 1]]],
  );
  const local = partitionTriangleAffineDomains(triangle, [[[-1, 1, 1]]]);
  expect(shifted.map((c) => Array.from(c.relativePositions))).toEqual(
    local.map((c) => Array.from(c.relativePositions)),
  );
  expect(
    shifted.every(
      (c) => c.reference[0] === origin && area(c.relativePositions) > 0,
    ),
  ).toBe(true);
  expect(shifted.reduce((s, c) => s + area(c.relativePositions), 0)).toBe(0.5);
  // No API can recover coordinates already collapsed by its caller.
  expect(() =>
    partitionTriangleAffineDomains(
      [
        [origin, 0, 0],
        [origin + 0.25, 0, 0],
        [origin, 1, 0],
      ],
      [],
    ),
  ).toThrow();
});
