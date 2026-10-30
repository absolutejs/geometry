import { expect, test } from "bun:test";
import { tetrahedronPlaneMoments as clip } from "../src/tetrahedronPlaneMoments";
type V = readonly [number, number, number];
const tetra: readonly V[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
test("analytic tetrahedron cuts preserve volume and first moments", () => {
  for (const a of [0, 0.0001, 0.01, 0.1, 0.25, 0.5, 0.9, 0.99, 0.9999, 1]) {
    const result = clip(tetra, [a, 0, 0], [1, 0, 0]);
    const removed = (1 - a) ** 3 / 6,
      volume = 1 / 6 - removed;
    expect(result.signedVolume).toBeCloseTo(volume, 13);
    if (a > 0) {
      const center = [
        (1 / 24 - (removed * (1 + 3 * a)) / 4) / volume,
        (1 / 24 - (removed * (1 - a)) / 4) / volume,
        (1 / 24 - (removed * (1 - a)) / 4) / volume,
      ];
      for (let k = 0; k < 3; k++)
        expect(result.centroid![k]!).toBeCloseTo(center[k]!, 10);
    } else expect(result.centroid).toBeNull();
    const tip = clip(tetra, [a, 0, 0], [-1, 0, 0]);
    expect(result.signedVolume + tip.signedVolume).toBeCloseTo(1 / 6, 14);
    for (let k = 0; k < 3; k++)
      expect(result.firstMoment[k]! + tip.firstMoment[k]!).toBeCloseTo(
        -1 / 24,
        14,
      );
  }
  for (const a of [0.001, 0.1, 0.4, 0.9, 1]) {
    const r = clip(tetra, [a, 0, 0], [1, 1, 1]);
    expect(r.signedVolume).toBeCloseTo(a ** 3 / 6, 14);
    for (const c of r.centroid!) expect(c).toBeCloseTo(a / 4, 12);
  }
});
test("oriented moments preserve complementary cuts through general planes", () => {
  for (let i = 1; i <= 150; i++) {
    const n: V = [Math.sin(i * 1.3), Math.cos(i * 0.7), Math.sin(i * 0.43)],
      p: V = [0.4 * Math.sin(i), 0.3, 0.4];
    const a = clip(tetra, p, n),
      b = clip(tetra, p, n.map((v) => -v) as unknown as V),
      reversed = clip([tetra[0]!, tetra[2]!, tetra[1]!, tetra[3]!], p, n);
    expect(a.signedVolume + b.signedVolume).toBeCloseTo(1 / 6, 13);
    expect(reversed.signedVolume).toBeCloseTo(-a.signedVolume, 13);
    expect(a.fraction).toBeGreaterThanOrEqual(0);
    expect(a.fraction).toBeLessThanOrEqual(1 + 1e-12);
    for (let k = 0; k < 3; k++)
      expect(a.firstMoment[k]! + b.firstMoment[k]!).toBeCloseTo(-1 / 24, 13);
  }
});
test("local normalization retains small representable tetrahedra and leaves caller data alone", () => {
  for (const scale of [1e-8, 1e-4, 1, 1e6]) {
    const points = tetra.map(
        (v) => v.map((x, k) => x * scale + [3, 2, 1][k]!) as unknown as V,
      ),
      copy = JSON.stringify(points);
    const half = clip(points, [3 + scale / 2, 2, 1], [1000, 0, 0]);
    expect(half.fraction).toBeCloseTo(0.875, 7);
    expect(JSON.stringify(points)).toBe(copy);
    expect(half.centroid!.every(Number.isFinite)).toBe(true);
  }
  expect(() => clip(tetra, [0, 0, 0], [0, 0, 0])).toThrow("Zero");
  expect(() => clip(tetra, [NaN, 0, 0], [1, 0, 0])).toThrow("Invalid");
  expect(() =>
    clip([tetra[0]!, tetra[1]!, tetra[2]!, tetra[2]!], [0, 0, 0], [1, 0, 0]),
  ).toThrow("Degenerate");
});

test("tiny wet corners retain represented volumes instead of subtracting large pyramids", () => {
  for (const a of [1e-4, 1e-8, 1e-12, 1e-20, 1e-60]) {
    const r = clip(tetra, [a, 0, 0], [1, 1, 1]);
    expect(Math.abs(r.signedVolume / ((a * a * a) / 6) - 1)).toBeLessThan(
      1e-12,
    );
    for (const c of r.centroid!)
      expect(Math.abs(c / (a / 4) - 1)).toBeLessThan(1e-12);
  }
});

test("signed tetrahedral composition measures a box from an exterior origin", () => {
  const cube = Array.from(
    { length: 8 },
    (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1] as V,
  );
  const faces = [
    [0, 4, 2],
    [2, 4, 6],
    [1, 3, 5],
    [3, 7, 5],
    [0, 1, 4],
    [1, 5, 4],
    [2, 6, 3],
    [3, 6, 7],
    [0, 2, 1],
    [1, 2, 3],
    [4, 5, 6],
    [5, 7, 6],
  ];
  for (const level of [0.001, 0.1, 0.5, 0.99]) {
    let volume = 0;
    const moment = [0, 0, 0];
    let negative = 0;
    for (const face of faces) {
      const r = clip(
        [[-2, 3, -1], ...face.map((i) => cube[i]!)],
        [level, 0, 0],
        [1, 0, 0],
      );
      volume += r.signedVolume;
      if (r.signedVolume < 0) negative++;
      for (let k = 0; k < 3; k++)
        moment[k]! += r.firstMoment[k]! + r.reference[k]! * r.signedVolume;
    }
    expect(negative).toBeGreaterThan(0);
    expect(volume).toBeCloseTo(level, 13);
    expect(moment[0]! / volume).toBeCloseTo(level / 2, 11);
    expect(moment[1]! / volume).toBeCloseTo(0.5, 11);
    expect(moment[2]! / volume).toBeCloseTo(0.5, 11);
  }
});
test("normal scaling is immaterial and unrepresentable first moments fail explicitly", () => {
  const expected = clip(tetra, [0.2, 0, 0], [1, 2, 3]);
  for (const factor of [1e-300, 1e300]) {
    const r = clip(tetra, [0.2, 0, 0], [factor, 2 * factor, 3 * factor]);
    expect(r.fraction).toBeCloseTo(expected.fraction, 14);
  }
  const tiny = tetra.map((v) => v.map((x) => x * 1e-100) as unknown as V);
  expect(() => clip(tiny, [1, 0, 0], [1, 0, 0])).toThrow(
    "Unrepresentable tetrahedron moments",
  );
});
