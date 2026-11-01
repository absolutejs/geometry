import { expect, test } from "bun:test";
import { prepareTrianglePositiveLinearMoments as prepare } from "../src/trianglePositiveLinearMoments";
import { prepareTrianglePositiveQuadraticMoments } from "../src/trianglePositiveQuadraticMoments";
const triangle = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
] as const;
const query = prepare(triangle);
const relative = (actual: number, expected: number, tolerance = 1e-12) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThan(tolerance);
test("linear positive pressure preserves exact integrals, boundary zeros and thin wet regions", () => {
  for (const a of [0, 0.1, 0.5, 0.9, 1 - 2 ** -30, 1]) {
    const b = 1 - a,
      r = query([-a, b, -a]);
    if (b === 0) {
      expect(r.integral).toBe(0);
      expect(r.meanOffset).toBeNull();
      continue;
    }
    relative(r.area, (b * b) / 2);
    relative(r.integral, b ** 3 / 6);
    relative(r.relativeFirstMoment[0], (a * b ** 3) / 6 + b ** 4 / 12);
    relative(r.relativeFirstMoment[1], b ** 4 / 24);
  }
  expect(query([0, 1, 0], [0, 1, 0])).toEqual(query([0, 1, 0]));
  for (const field of [
    [0, 0, 0],
    [-1, -2, -3],
    [-1, 0, -1],
  ]) {
    expect(query(field).integral).toBe(0);
    expect(query([1, 2, 3], field).integral).toBe(0);
  }
  const full = query([1, 2, 3]);
  relative(full.integral, 1);
  relative(full.relativeFirstMoment[0], 1 / 3);
  relative(full.relativeFirstMoment[1], 3 / 8);
  expect("cubicIntegral" in full).toBe(false);
});
test("two affine restrictions agree with independent strip integration", () => {
  for (const a of [0, 0.3, 0.8])
    for (const fraction of [1e-9, 0.2, 0.7, 1]) {
      const b = 1 - a,
        d = b * fraction,
        r = query([-a, b, -a], [d, d, d - 1]);
      const integral = (b * b * d - b * d * d + d ** 3 / 3) / 2;
      relative(r.area, b * d - (d * d) / 2, 1e-6);
      relative(r.integral, integral, 1e-6);
      relative(
        r.relativeFirstMoment[0],
        a * integral +
          (b ** 3 * d - 1.5 * b * b * d * d + b * d ** 3 - d ** 4 / 4) / 3,
        1e-6,
      );
      relative(
        r.relativeFirstMoment[1],
        ((b * b * d * d) / 2 - (2 * b * d ** 3) / 3 + d ** 4 / 4) / 2,
        1e-6,
      );
    }
});
test("linear moments retain scale, winding, relative coordinates and ownership", () => {
  for (const scale of [1e-40, 1, 1e40])
    for (const field of [1e-100, 1, 1e100]) {
      const r = prepare([
        [0, 0, 0],
        [scale, 0, 0],
        [0, scale, 0],
      ])([0, field, 0]);
      relative(r.integral, (scale * scale * field) / 6);
      relative(r.relativeFirstMoment[0], (scale * scale * scale * field) / 12);
      relative(r.relativeFirstMoment[1], (scale * scale * scale * field) / 24);
    }
  const points: [number, number, number][] = [
      [1e12, 2, 3],
      [1e12 + 2, 2, 3],
      [1e12, 2, 5],
    ],
    p = prepare(points),
    r = p([1, 2, 3]);
  points[0]![0] = 0;
  r.reference[0] = 0;
  r.surfaceNormal[0] = 999;
  r.relativeFirstMoment[0] = 999;
  expect(p([1, 2, 3]).reference).toEqual([1e12, 2, 3]);
  expect(p([1, 2, 3]).surfaceNormal).toEqual([0, -1, 0]);
  const reversed = prepare([triangle[0], triangle[2], triangle[1]])([1, 3, 2]);
  expect(reversed.surfaceNormal).toEqual([0, 0, -1]);
  relative(reversed.integral, query([1, 2, 3]).integral);
});
test("invalid linear inputs and unrepresentable moments fail explicitly", () => {
  expect(() =>
    prepare([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]),
  ).toThrow();
  for (const values of [
    [1, 2],
    [1, 2, NaN],
    [Infinity, 1, 1],
  ])
    expect(() => query(values)).toThrow();
  expect(() => query([1, 2, 3], [1, 2])).toThrow();
  expect(() => query([1, 2, 3], [1, NaN, 1])).toThrow();
  expect(() =>
    prepare([
      [0, 0, 0],
      [1e100, 0, 0],
      [0, 1e100, 0],
    ])([1e200, 1e200, 1e200]),
  ).toThrow();
});
test("exposed-surface pressure distinguishes free buoyancy, a sealed bottom and empty fluid", () => {
  const points = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 1, -0.5],
    [-0.5, 1, -0.5],
    [-0.5, 0, 0.5],
    [0.5, 0, 0.5],
    [0.5, 1, 0.5],
    [-0.5, 1, 0.5],
  ] as [number, number, number][];
  const triangles = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [3, 7, 6],
    [3, 6, 2],
    [0, 4, 7],
    [0, 7, 3],
    [1, 2, 6],
    [1, 6, 5],
  ];
  for (const sealed of [false, true])
    for (const water of [0, 0.5, 2]) {
      const force = [0, 0, 0],
        torque = [0, 0, 0];
      for (const ids of triangles) {
        const p = ids.map(
          (i) =>
            points[i]!.map((v, k) => v + (k === 0 ? 3 : k === 2 ? -2 : 0)) as [
              number,
              number,
              number,
            ],
        );
        const r = prepare(p)(
            p.map((v) => water - v[1]),
            sealed ? p.map((v) => v[1]) : undefined,
          ),
          n = r.surfaceNormal;
        const m = r.reference.map(
          (v, k) => v * r.integral + r.relativeFirstMoment[k]!,
        );
        for (let k = 0; k < 3; k++) force[k]! -= n[k]! * r.integral;
        torque[0]! -= m[1]! * n[2] - m[2]! * n[1];
        torque[1]! -= m[2]! * n[0] - m[0]! * n[2];
        torque[2]! -= m[0]! * n[1] - m[1]! * n[0];
      }
      const up = sealed ? (water > 1 ? -(water - 1) : 0) : Math.min(1, water);
      expect(force[0]).toBeCloseTo(0, 12);
      expect(force[1]).toBeCloseTo(up, 12);
      expect(force[2]).toBeCloseTo(0, 12);
      expect(torque[0]).toBeCloseTo(2 * up, 12);
      expect(torque[1]).toBeCloseTo(0, 12);
      expect(torque[2]).toBeCloseTo(3 * up, 12);
    }
});

test("exact opposed domains remain empty while nearby thin positive domains survive", () => {
  const square = prepareTrianglePositiveQuadraticMoments(triangle);
  let seed = 123;
  for (let i = 0; i < 1000; i++) {
    const v = Array.from({ length: 3 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32 - 0.5;
    });
    for (const q of [query, square]) {
      const r = q(
        v,
        v.map((x) => -x),
      );
      expect(r.integral).toBe(0);
      expect(r.area).toBe(0);
      expect(r.meanOffset).toBeNull();
    }
  }
  const a = 0.25,
    b = 1 - a,
    e = 2 ** -30,
    values = [-a, b, -a],
    domain = [a + e, a + e - 1, a + e];
  const linear = query(values, domain),
    quadratic = square(values, domain);
  relative(linear.integral, (b * e * e) / 2 - e ** 3 / 3, 1e-6);
  relative(quadratic.integral, (b * e ** 3) / 3 - e ** 4 / 4, 1e-6);
  expect(linear.area).toBeGreaterThan(0);
  expect(quadratic.area).toBeGreaterThan(0);
});
