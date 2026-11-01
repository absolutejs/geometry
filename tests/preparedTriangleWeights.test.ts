import { test, expect } from "bun:test";
import {
  prepareTriangleWeights,
  triangleWeights,
} from "../src/triangleWeights";
test("prepared dominant-plane interpolation recovers analytic weights on every coordinate plane", () => {
  for (let axis = 0; axis < 3; axis++) {
    const a: [number, number, number] = [3, -2, 5],
      b: [number, number, number] = [...a],
      c: [number, number, number] = [...a];
    b[(axis + 1) % 3]! += 2;
    c[(axis + 2) % 3]! += 3;
    const query = prepareTriangleWeights(a, b, c);
    for (const w of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.2, 0.3, 0.5],
      [0.5, 0.5, 0],
    ]) {
      const p = a.map((x, k) => x * w[0]! + b[k]! * w[1]! + c[k]! * w[2]!) as [
        number,
        number,
        number,
      ];
      const actual = query(p);
      actual.forEach((x, k) => expect(x).toBeCloseTo(w[k]!, 13));
      p[axis]! += 1e-8;
      query(p).forEach((x, k) => expect(x).toBeCloseTo(w[k]!, 13));
      p[axis]! += 1e-5;
      expect(() => query(p)).toThrow("off surface");
    }
  }
});
test("prepared data and each result are owned; skinny sources retain seam rejection", () => {
  const a: [number, number, number] = [0, 0, 0],
    b: [number, number, number] = [1, 0, 0],
    c: [number, number, number] = [1, 1e-9, 0];
  const query = prepareTriangleWeights(a, b, c);
  const expected = query([0.5, 2.5e-10, 0]);
  expect(expected).toEqual([0.5, 0.25, 0.25]);
  a.fill(99);
  b.fill(99);
  c.fill(99);
  expected.fill(99);
  expect(query([0.5, 2.5e-10, 0])).toEqual([0.5, 0.25, 0.25]);
  expect(() => query([-0.01, 0, 0])).toThrow("outside");
  expect(() => query([0.5, 0, 1e-6])).toThrow("off surface");
});
test("nonrepresentable geometry and queries reject instead of returning NaN weights", () => {
  expect(() =>
    prepareTriangleWeights([0, 0, 0], [1e308, 0, 0], [0, 1e308, 0]),
  ).toThrow();
  const q = prepareTriangleWeights([0, 0, 0], [1, 0, 0], [0, 1, 0]);
  expect(() => q([NaN, 0, 0])).toThrow();
  expect(() => q([1e308, 1e308, 1e308])).toThrow();
  expect(() =>
    prepareTriangleWeights([0, 0, 0], [1, 0, 0], [0, 1, 0], 1e-8),
  ).toThrow();
  expect(() =>
    triangleWeights([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
  ).toThrow();
  const edge = q([-1e-5, 0.5, 0]);
  expect(edge[1]).toBe(0);
  expect(edge.reduce((s, x) => s + x, 0)).toBe(1);
});
