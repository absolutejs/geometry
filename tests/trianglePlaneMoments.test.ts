import { test, expect } from "bun:test";
import {
  prepareTrianglePlaneMoments,
  trianglePlaneMoments,
} from "../src/trianglePlaneMoments";
type V = [number, number, number];
const vertices: V[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
];
const close = (a: number, b: number, tolerance = 2e-13) =>
  expect(Math.abs(a - b)).toBeLessThan(tolerance);
test("analytic corner area, first moments, second moments and winding", () => {
  for (const scale of [1e-60, 1e-6, 1, 1e6, 1e60])
    for (const reverse of [false, true]) {
      const p = vertices.map((v) => v.map((x) => x * scale) as V);
      if (reverse) [p[1], p[2]] = [p[2]!, p[1]!];
      const q = prepareTrianglePlaneMoments(p);
      for (const f of [0.001, 0.1, 0.5, 0.99, 1]) {
        const r = q([f * scale, 0, 0], [1, 1, 0]);
        close(r.area / (scale * scale), (f * f) / 2);
        close(r.centroid![0] / scale, f / 3);
        close(r.centroid![1] / scale, f / 3);
        close(r.firstMoment[0] / (scale * scale * scale), f ** 3 / 6);
        close(r.secondMoment[0]! / scale ** 4, f ** 4 / 12);
        close(r.secondMoment[1]! / scale ** 4, f ** 4 / 24);
        expect(r.surfaceNormal[2]).toBe(reverse ? -1 : 1);
      }
    }
});
test("two wet vertices reproduce independent rectangle-minus-triangle integrals", () => {
  for (const a of [1e-10, 0.01, 0.25, 0.75, 0.999999]) {
    const r = trianglePlaneMoments(vertices, [a, 0, 0], [1, 0, 0]);
    close(r.area, a - (a * a) / 2);
    close(r.firstMoment[0], (a * a) / 2 - a ** 3 / 3);
    close(r.firstMoment[1], (a - a * a + a ** 3 / 3) / 2);
    close(r.secondMoment[0]!, a ** 3 / 3 - a ** 4 / 4);
    close(r.secondMoment[1]!, (a * a) / 4 - a ** 3 / 3 + a ** 4 / 8);
    close(r.secondMoment[4]!, a / 3 - (a * a) / 2 + a ** 3 / 3 - a ** 4 / 12);
  }
});
test("prepared inputs and returned arrays cannot mutate another query", () => {
  const p = vertices.map((v) => [...v] as V),
    q = prepareTrianglePlaneMoments(p);
  p[1]![0] = 99;
  const a = q([0.5, 0, 0], [1, 1, 0]);
  a.reference[0] = 99;
  a.surfaceNormal[0] = 99;
  a.firstMoment[0] = 99;
  a.secondMoment[0] = 99;
  a.centroid![0] = 99;
  const b = q([0.5, 0, 0], [1, 1, 0]);
  close(b.area, 0.125);
  close(b.centroid![0], 1 / 6);
  expect(b.reference).toEqual([0, 0, 0]);
  expect(b.surfaceNormal).toEqual([0, 0, 1]);
});
test("boundary conventions and invalid or unrepresentable inputs are explicit", () => {
  const q = prepareTrianglePlaneMoments(vertices);
  expect(q([0, 0, 0], [0, 0, 1]).area).toBe(0.5);
  expect(q([0, 0, 0], [1, 1, 0]).area).toBe(0);
  expect(q([0, 0, 0], [1, 1, 0]).centroid).toBeNull();
  expect(() => q([0, 0, 0], [0, 0, 0])).toThrow("Zero clipping normal");
  expect(() =>
    prepareTrianglePlaneMoments([
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ]),
  ).toThrow("Degenerate triangle");
  expect(() => q([NaN, 0, 0], [1, 0, 0])).toThrow(
    "Invalid triangle plane input",
  );
  expect(() => q([1e-200, 0, 0], [1, 1, 0])).toThrow("Unrepresentable");
});

test("translated arbitrary planes partition all area moments with reference rebasing", () => {
  let state = 71891;
  const random = () =>
    ((state = (Math.imul(state, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  for (let trial = 0; trial < 300; trial++) {
    const offset: V = [10000, -7000, 3000];
    const points = Array.from(
      { length: 3 },
      () => offset.map((x) => x + random() * 2 - 1) as V,
    );
    const normal = [random() - 0.5, random() - 0.5, random() - 0.5] as V;
    const point = offset.map((x) => x + (random() - 0.5) * 0.5) as V;
    const query = prepareTrianglePlaneMoments(points);
    const parts = [
      query(point, normal),
      query(point, normal.map((x) => -x) as V),
    ];
    const a = points[1]!.map((x, k) => x - points[0]![k]!) as V;
    const b = points[2]!.map((x, k) => x - points[0]![k]!) as V;
    const area =
      Math.hypot(
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ) / 2;
    const local = points.map((p) => p.map((x, k) => x - offset[k]!));
    close(
      parts.reduce((s, p) => s + p.area, 0),
      area,
      1e-11,
    );
    for (let r = 0; r < 3; r++) {
      const expectedFirst = (area * local.reduce((s, p) => s + p[r]!, 0)) / 3;
      close(
        parts.reduce(
          (s, p) =>
            s + p.firstMoment[r]! + (p.reference[r]! - offset[r]!) * p.area,
          0,
        ),
        expectedFirst,
        1e-11,
      );
      for (let c = 0; c < 3; c++) {
        const expectedSecond =
          (area *
            (local.reduce((s, p) => s + p[r]!, 0) *
              local.reduce((s, p) => s + p[c]!, 0) +
              local.reduce((s, p) => s + p[r]! * p[c]!, 0))) /
          12;
        const actual = parts.reduce((s, p) => {
          const dr = p.reference[r]! - offset[r]!,
            dc = p.reference[c]! - offset[c]!;
          return (
            s +
            p.secondMoment[r * 3 + c]! +
            dr * p.firstMoment[c]! +
            dc * p.firstMoment[r]! +
            dr * dc * p.area
          );
        }, 0);
        close(actual, expectedSecond, 1e-11);
      }
    }
  }
});
